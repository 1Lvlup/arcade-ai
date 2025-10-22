import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { manual_id } = await req.json();

    if (!manual_id) {
      throw new Error('manual_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔍 Processing ALL images in manual: ${manual_id}`);

    // Get user context from the request header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get ALL figures with storage paths (just like the wand button does)
    const { data: figures, error: fetchError } = await supabase
      .from('figures')
      .select('id, manual_id, page_number, figure_id, storage_path')
      .eq('manual_id', manual_id)
      .not('storage_path', 'is', null);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${figures?.length || 0} total figures to process`);

    let processedCount = 0;
    let successCount = 0;
    const errors: string[] = [];

    // Process each figure by calling generate-image-caption (same as wand button)
    for (const figure of figures || []) {
      try {
        console.log(`\n🖼️ Processing figure ${processedCount + 1}/${figures.length}: ${figure.figure_id}`);
        
        // Call the same function that the wand button uses
        const captionResponse = await fetch(`${supabaseUrl}/functions/v1/generate-image-caption`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            figure_id: figure.id,
            storage_path: figure.storage_path,
            manual_id: manual_id
          })
        });

        if (!captionResponse.ok) {
          const errorText = await captionResponse.text();
          throw new Error(`Caption generation failed: ${captionResponse.status} - ${errorText}`);
        }

        const captionResult = await captionResponse.json();
        
        if (captionResult.success) {
          console.log(`✅ Successfully processed ${figure.figure_id || figure.id}`);
          successCount++;
        } else {
          throw new Error(captionResult.error || 'Unknown error from caption generation');
        }

        // Update processing_status with progress
        if (processedCount % 5 === 0) {
          const progressPercent = 90 + Math.round((successCount / figures.length) * 10);
          
          await supabase
            .from('processing_status')
            .update({
              figures_processed: successCount,
              progress_percent: Math.min(progressPercent, 99),
              current_task: `Processing images: ${successCount}/${figures.length} completed`
            })
            .eq('manual_id', manual_id);
        }

      } catch (error) {
        console.error(`❌ Error processing figure ${figure.id}:`, error);
        errors.push(`${figure.figure_id || figure.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      processedCount++;
      
      // Add a small delay to avoid overwhelming the system
      if (processedCount % 3 === 0) {
        console.log(`⏸️ Processed ${processedCount} images, pausing briefly...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`✅ Processing complete: ${successCount}/${processedCount} successful`);

    // Mark processing as complete
    await supabase
      .from('processing_status')
      .update({
        figures_processed: successCount,
        progress_percent: 100,
        status: 'completed',
        current_task: 'Image processing completed'
      })
      .eq('manual_id', manual_id);

    return new Response(
      JSON.stringify({
        success: true,
        manual_id,
        total_figures: figures?.length || 0,
        processed: processedCount,
        successful: successCount,
        failed: processedCount - successCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-all-ocr function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
