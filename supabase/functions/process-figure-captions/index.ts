import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { manual_id } = await req.json();

    if (!manual_id) {
      throw new Error('manual_id is required');
    }

    console.log(`🔍 Processing captions for manual: ${manual_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const openaiProjectId = Deno.env.get('OPENAI_PROJECT_ID');

    if (!openaiApiKey || !openaiProjectId) {
      throw new Error('OpenAI credentials not configured');
    }

    // Get manual details for context
    const { data: manual } = await supabase
      .from('documents')
      .select('title')
      .eq('manual_id', manual_id)
      .single();

    // Get total figures count for this manual
    const { count: totalFigures } = await supabase
      .from('figures')
      .select('*', { count: 'exact', head: true })
      .eq('manual_id', manual_id);

    // Get figures that still need captions
    const { data: figures, error: fetchError } = await supabase
      .from('figures')
      .select('id, storage_url, page_number, image_name')
      .eq('manual_id', manual_id)
      .is('caption_text', null)
      .order('page_number', { ascending: true });

    if (fetchError) throw fetchError;

    // Get count of already captioned figures
    const { count: captionedCount } = await supabase
      .from('figures')
      .select('*', { count: 'exact', head: true })
      .eq('manual_id', manual_id)
      .not('caption_text', 'is', null);

    const alreadyCaptioned = captionedCount || 0;
    const total = totalFigures || 0;

    if (!figures || figures.length === 0) {
      // Mark as complete
      await supabase
        .from('processing_status')
        .upsert({
          manual_id,
          job_id: `caption-${manual_id}-complete`,
          status: 'completed',
          stage: 'caption_complete',
          current_task: `All ${total} figures captioned`,
          total_figures: total,
          figures_processed: total,
          progress_percent: 100,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'manual_id'
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All figures already have captions',
          processed: total,
          total: total
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${figures.length} figures needing captions (${alreadyCaptioned}/${total} already done)`);

    // Update processing status to continue from where we left off
    await supabase
      .from('processing_status')
      .upsert({
        manual_id,
        job_id: `caption-${manual_id}-${Date.now()}`,
        status: 'processing',
        stage: 'caption_generation',
        current_task: `Resuming: ${alreadyCaptioned}/${total} complete`,
        total_figures: total,
        figures_processed: alreadyCaptioned,
        progress_percent: Math.round((alreadyCaptioned / total) * 100),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'manual_id'
      });

    // Start background processing
    const processInBackground = async () => {
      const BATCH_SIZE = 5;
      let batchProcessed = 0;
      let succeeded = 0;
      let failed = 0;

      // Process in batches
      for (let i = 0; i < figures.length; i += BATCH_SIZE) {
        const batch = figures.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(batch.map(async (figure) => {
          try {
            // Validate storage URL exists
            if (!figure.storage_url || figure.storage_url.trim() === '') {
              console.error(`❌ Figure ${figure.id} has no storage_url, skipping`);
              return { 
                success: false, 
                image_name: figure.image_name,
                error: 'No storage URL'
              };
            }

            // Generate caption using GPT-4o Vision
            const captionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Project': openaiProjectId,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                max_tokens: 500,
                messages: [
                  {
                    role: 'system',
                    content: `You are analyzing technical manual images for "${manual?.title || 'a technical manual'}". Generate detailed, technical captions that describe what the image shows, including any visible text, diagrams, parts, specifications, or instructions.`
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Generate a detailed caption for this technical manual image. Describe what is shown, any visible text, diagrams, parts, or specifications.'
                      },
                      {
                        type: 'image_url',
                        image_url: { url: figure.storage_url }
                      }
                    ]
                  }
                ],
              }),
            });

            if (!captionResponse.ok) {
              const errorText = await captionResponse.text();
              console.error(`Caption API error for figure ${figure.id}: ${captionResponse.status} - ${errorText}`);
              
              // If it's an image download error, skip this image and continue
              if (errorText.includes('invalid_image_url') || errorText.includes('Error while downloading')) {
                console.log(`⚠️ Skipping figure ${figure.id} - image not accessible`);
                return { 
                  success: false, 
                  image_name: figure.image_name,
                  error: 'Image not accessible'
                };
              }
              
              throw new Error(`Caption API error: ${captionResponse.status} - ${errorText.substring(0, 200)}`);
            }

            const captionData = await captionResponse.json();
            const captionText = captionData.choices[0].message.content;

            // Generate embedding for the caption
            let embedding = null;

            if (captionText.length > 0) {
              const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openaiApiKey}`,
                  'OpenAI-Project': openaiProjectId,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'text-embedding-3-small',
                  input: captionText.substring(0, 8000)
                })
              });

              if (embeddingResponse.ok) {
                const embeddingData = await embeddingResponse.json();
                embedding = embeddingData.data[0].embedding;
              }
            }

            // Update figure with caption and embedding
            const { error: updateError } = await supabase
              .from('figures')
              .update({
                caption_text: captionText,
                embedding_text: embedding
              })
              .eq('id', figure.id);

            if (updateError) throw updateError;

            return { success: true, image_name: figure.image_name };

          } catch (error) {
            console.error(`❌ Error processing figure ${figure.id}:`, error);
            return { 
              success: false, 
              image_name: figure.image_name,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        }));

        // Count results
        batchResults.forEach(result => {
          batchProcessed++;
          if (result.status === 'fulfilled' && result.value.success) {
            succeeded++;
          } else {
            failed++;
          }
        });

        // Calculate total progress including already captioned
        const totalProcessed = alreadyCaptioned + succeeded;
        const progressPercent = Math.round((totalProcessed / total) * 100);
        
        // Update progress in database
        await supabase
          .from('processing_status')
          .update({
            figures_processed: totalProcessed,
            progress_percent: progressPercent,
            current_task: `Processing: ${totalProcessed}/${total} complete`,
            updated_at: new Date().toISOString()
          })
          .eq('manual_id', manual_id);

        console.log(`📊 Progress: ${totalProcessed}/${total} (this batch: ${batchProcessed}/${figures.length}, ✅ ${succeeded} success, ❌ ${failed} failed)`);
      }

      // Mark as complete
      const finalProcessed = alreadyCaptioned + succeeded;
      await supabase
        .from('processing_status')
        .update({
          status: 'completed',
          stage: 'caption_complete',
          figures_processed: finalProcessed,
          progress_percent: 100,
          current_task: `Completed: ${finalProcessed}/${total} figures captioned (${succeeded} in this run, ${failed} failed)`,
          updated_at: new Date().toISOString()
        })
        .eq('manual_id', manual_id);

      console.log(`🎉 Caption processing complete: ${finalProcessed}/${total} total (${succeeded} in this run)`);
    };

    // Use waitUntil to process in background
    EdgeRuntime.waitUntil(processInBackground());

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: `Caption processing started in background (${alreadyCaptioned}/${total} already complete)`,
        total: total,
        remaining: figures.length,
        already_captioned: alreadyCaptioned,
        status: 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
