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
      .single();

    if (statusError) {
      console.error('[retry-processing] Error fetching status:', statusError);
      throw new Error(`Failed to fetch processing status: ${statusError.message}`);
    }

    if (!statusData) {
      throw new Error(`No processing status found for manual: ${manual_id}`);
    }

    console.log(`[retry-processing] Current status:`, {
      status: statusData.status,
      stage: statusData.stage,
      total_figures: statusData.total_figures,
      figures_processed: statusData.figures_processed,
      updated_at: statusData.updated_at
    });

    // Get all pending figures
    const { data: figures, error: figuresError } = await supabase
      .from('figures')
      .select('id, page_number, storage_url')
      .eq('manual_id', manual_id)
      .eq('ocr_status', 'pending')
      .not('storage_url', 'is', null)
      .order('page_number');

    if (figuresError) {
      console.error('[retry-processing] Error fetching figures:', figuresError);
      throw new Error(`Failed to fetch figures: ${figuresError.message}`);
    }

    console.log(`[retry-processing] Found ${figures?.length || 0} pending figures to process`);

    if (!figures || figures.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending figures to process',
          manual_id,
          pending_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update processing status to show we're resuming
    const { error: updateError } = await supabase
      .from('processing_status')
      .update({
        status: 'processing',
        stage: 'image_enhancement',
        current_task: `Resuming: Processing ${figures.length} pending figures`,
        updated_at: new Date().toISOString()
      })
      .eq('manual_id', manual_id);

    if (updateError) {
      console.error('[retry-processing] Error updating status:', updateError);
    }

    // Process figures in batches of 10
    const batchSize = 10;
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
              image_url: figure.storage_url
            }
          });

          if (error) {
            console.error(`[retry-processing] Error processing figure ${figure.id}:`, error);
            return { success: false, figure_id: figure.id, error: error.message };
          }

          processed++;
          
          // Update progress
          await supabase
            .from('processing_status')
            .update({
              figures_processed: statusData.figures_processed + processed,
              current_task: `Processing figures: ${statusData.figures_processed + processed}/${statusData.total_figures}`,
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
        figures_processed: statusData.figures_processed + processed,
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
