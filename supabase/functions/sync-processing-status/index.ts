import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { manual_id } = await req.json();

    if (!manual_id) {
      throw new Error('manual_id is required');
    }

    console.log(`🔄 Syncing processing status for manual: ${manual_id}`);

    // Get actual counts from database
    const { data: chunkCount } = await supabase
      .from('chunks_text')
      .select('*', { count: 'exact', head: true })
      .eq('manual_id', manual_id);

    const { data: totalFigures } = await supabase
      .from('figures')
      .select('*', { count: 'exact', head: true })
      .eq('manual_id', manual_id);

    const { data: figuresWithStorage } = await supabase
      .from('figures')
      .select('*', { count: 'exact', head: true })
      .eq('manual_id', manual_id)
      .not('storage_url', 'is', null);

    const { data: figuresCompleted } = await supabase
      .from('figures')
      .select('*', { count: 'exact', head: true })
      .eq('manual_id', manual_id)
      .eq('ocr_status', 'completed');

    const actualChunks = chunkCount?.length ?? 0;
    const actualTotalFigures = totalFigures?.length ?? 0;
    const actualFiguresWithStorage = figuresWithStorage?.length ?? 0;
    const actualFiguresProcessed = figuresCompleted?.length ?? 0;

    console.log(`📊 Actual counts:
      - Text chunks: ${actualChunks}
      - Total figures: ${actualTotalFigures}
      - Figures with storage URL: ${actualFiguresWithStorage}
      - Figures OCR completed: ${actualFiguresProcessed}
    `);

    // Determine status
    let newStatus = 'processing';
    let newStage = 'unknown';
    let currentTask = '';
    let progressPercent = 0;

    if (actualChunks === 0 && actualTotalFigures === 0) {
      newStatus = 'processing';
      newStage = 'waiting_for_llamacloud';
      currentTask = 'Waiting for LlamaCloud to begin processing';
      progressPercent = 10;
    } else if (actualFiguresWithStorage === 0 && actualTotalFigures > 0) {
      // Figures exist but no storage URLs - stuck waiting for LlamaCloud uploads
      newStatus = 'stalled';
      newStage = 'awaiting_image_upload';
      currentTask = `${actualTotalFigures} figures extracted, awaiting image upload to storage by LlamaCloud (0/${actualTotalFigures} uploaded)`;
      progressPercent = 85;
    } else if (actualFiguresProcessed < actualFiguresWithStorage) {
      // Images available but OCR incomplete
      newStatus = 'processing';
      newStage = 'ocr_processing';
      currentTask = `Processing OCR: ${actualFiguresProcessed}/${actualFiguresWithStorage} figures completed`;
      progressPercent = 90 + Math.round((actualFiguresProcessed / actualFiguresWithStorage) * 10);
    } else if (actualFiguresProcessed === actualFiguresWithStorage && actualFiguresWithStorage === actualTotalFigures) {
      // Everything complete
      newStatus = 'completed';
      newStage = 'completed';
      currentTask = `Processing complete: ${actualChunks} text chunks, ${actualFiguresProcessed} figures processed`;
      progressPercent = 100;
    } else {
      // Partial completion
      newStatus = 'partially_complete';
      newStage = 'review_needed';
      currentTask = `${actualChunks} text chunks, ${actualFiguresProcessed}/${actualTotalFigures} figures processed (${actualTotalFigures - actualFiguresWithStorage} missing storage URLs)`;
      progressPercent = 95;
    }

    // Update processing_status with actual values
    const { error: updateError } = await supabase
      .from('processing_status')
      .update({
        status: newStatus,
        stage: newStage,
        current_task: currentTask,
        total_chunks: actualChunks,
        chunks_processed: actualChunks,
        total_figures: actualTotalFigures,
        figures_processed: actualFiguresProcessed,
        progress_percent: progressPercent,
        updated_at: new Date().toISOString()
      })
      .eq('manual_id', manual_id);

    if (updateError) {
      throw updateError;
    }

    const result = {
      manual_id,
      status: newStatus,
      stage: newStage,
      actual_counts: {
        chunks: actualChunks,
        total_figures: actualTotalFigures,
        figures_with_storage: actualFiguresWithStorage,
        figures_ocr_completed: actualFiguresProcessed
      },
      message: currentTask
    };

    console.log(`✅ Status synced successfully:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('❌ Error syncing status:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
