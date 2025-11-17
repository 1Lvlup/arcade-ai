import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    console.log(`[retry-processing] Starting retry for manual: ${manual_id}`);

    // Get the processing status
    const { data: statusData, error: statusError } = await supabase
      .from('processing_status')
      .select('*')
      .eq('manual_id', manual_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (statusError) {
      console.error('[retry-processing] Error fetching status:', statusError);
      throw new Error(`Failed to fetch processing status: ${statusError.message}`);
    }

    if (!statusData) {
      console.warn('[retry-processing] No processing status found for manual:', manual_id);
      // Create a minimal status object to continue
      const { error: createError } = await supabase
        .from('processing_status')
        .insert({
          manual_id,
          job_id: 'manual-retry',
          status: 'processing',
          stage: 'image_enhancement',
          figures_processed: 0,
          total_figures: 0
        });

      if (createError) {
        console.error('[retry-processing] Error creating status:', createError);
      }
    }

    console.log(`[retry-processing] Current status:`, {
      status: statusData?.status,
      stage: statusData?.stage,
      total_figures: statusData?.total_figures,
      figures_processed: statusData?.figures_processed,
      updated_at: statusData?.updated_at
    });

    // Get statistics about pending figures
    const { data: stats, error: statsError } = await supabase
      .from('figures')
      .select('id, page_number, storage_url, ocr_status, dropped')
      .eq('manual_id', manual_id);

    if (statsError) {
      console.error('[retry-processing] Error fetching figures:', statsError);
      throw new Error(`Failed to fetch figures: ${statsError.message}`);
    }

    const totalFigures = stats?.length || 0;
    const pendingWithUrl = stats?.filter(f => f.ocr_status === 'pending' && !f.dropped && f.storage_url) || [];
    const pendingWithoutUrl = stats?.filter(f => f.ocr_status === 'pending' && !f.dropped && !f.storage_url) || [];
    const completed = stats?.filter(f => f.ocr_status === 'completed') || [];
    const dropped = stats?.filter(f => f.dropped) || [];

    console.log(`[retry-processing] Figure statistics:`, {
      total: totalFigures,
      completed: completed.length,
      pending_with_url: pendingWithUrl.length,
      pending_without_url: pendingWithoutUrl.length,
      dropped: dropped.length
    });

    // If no figures are ready to process
    if (pendingWithUrl.length === 0) {
      let message = 'No figures ready to process';
      if (pendingWithoutUrl.length > 0) {
        message = `${pendingWithoutUrl.length} figures are pending but images haven't been uploaded to storage yet. The LlamaCloud processing is still extracting images.`;
      } else if (completed.length === totalFigures) {
        message = 'All figures have been processed!';
      }

      return new Response(
        JSON.stringify({
          success: true,
          message,
          manual_id,
          stats: {
            total: totalFigures,
            completed: completed.length,
            pending_with_url: pendingWithUrl.length,
            pending_without_url: pendingWithoutUrl.length,
            dropped: dropped.length
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const figures = pendingWithUrl;

    // Update processing status to show we're resuming with proper total_figures
    const { error: updateError } = await supabase
      .from('processing_status')
      .update({
        status: 'processing',
        stage: 'image_enhancement',
        total_figures: figures.length,
        figures_processed: 0,
        current_task: `Processing figures: 0/${figures.length} complete`,
        updated_at: new Date().toISOString()
      })
      .eq('manual_id', manual_id);

    if (updateError) {
      console.error('[retry-processing] Error updating status:', updateError);
    }

    // Process figures in batches of 5 (reduced from 10 to avoid timeouts)
    const batchSize = 5;
    let processed = 0;
    
    for (let i = 0; i < figures.length; i += batchSize) {
      const batch = figures.slice(i, i + batchSize);
      
      console.log(`[retry-processing] Processing batch ${i / batchSize + 1} (${batch.length} figures)`);

      // Process each figure in the batch
      const batchPromises = batch.map(async (figure) => {
        try {
          // Call the generate-image-caption function
          const { data, error } = await supabase.functions.invoke('generate-image-caption', {
            body: {
              figure_id: figure.id,
              manual_id: manual_id,
              storage_path: figure.storage_url
            }
          });

          if (error) {
            console.error(`[retry-processing] Error processing figure ${figure.id}:`, error);
            return { success: false, figure_id: figure.id, error: error.message };
          }

          processed++;
          
          // Update progress with accurate counts
          await supabase
            .from('processing_status')
            .update({
              figures_processed: processed,
              current_task: `Processing figures: ${processed}/${figures.length} complete`,
              updated_at: new Date().toISOString()
            })
            .eq('manual_id', manual_id);

          return { success: true, figure_id: figure.id };
        } catch (err) {
          console.error(`[retry-processing] Exception processing figure ${figure.id}:`, err);
          return { success: false, figure_id: figure.id, error: err.message };
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < figures.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final status update
    const { error: finalError } = await supabase
      .from('processing_status')
      .update({
        status: 'completed',
        stage: 'completed',
        current_task: `Completed processing ${processed} figures`,
        figures_processed: processed,
        total_figures: figures.length,
        updated_at: new Date().toISOString()
      })
      .eq('manual_id', manual_id);

    if (finalError) {
      console.error('[retry-processing] Error in final status update:', finalError);
    }

    console.log(`[retry-processing] Completed! Processed ${processed} figures`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully processed ${processed} figures`,
        manual_id,
        processed_count: processed,
        total_pending: figures.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[retry-processing] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
