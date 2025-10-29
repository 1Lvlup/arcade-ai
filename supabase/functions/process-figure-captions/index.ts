import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BATCH_LIMIT = 50; // Process up to 50 figures per invocation to avoid timeout

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

    // Get figures that still need captions OR OCR
    const { data: figures, error: fetchError } = await supabase
      .from('figures')
      .select('id, storage_url, page_number, image_name, caption_text, ocr_text')
      .eq('manual_id', manual_id)
      .or('caption_text.is.null,ocr_text.is.null')
      .order('page_number', { ascending: true });

    if (fetchError) throw fetchError;

    // Get count of figures that have BOTH caption and OCR completed
    const { count: captionedCount } = await supabase
      .from('figures')
      .select('*', { count: 'exact', head: true })
      .eq('manual_id', manual_id)
      .not('caption_text', 'is', null)
      .not('ocr_text', 'is', null);

    const alreadyCaptioned = captionedCount || 0;
    const total = totalFigures || 0;

    if (!figures || figures.length === 0) {
      console.log(`✅ No remaining figures to process. Total: ${total}, Already done: ${alreadyCaptioned}`);
      
      // Mark as complete ONLY when all figures are truly done
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
    
    // Limit to MAX_BATCH_LIMIT figures per invocation
    const figuresToProcess = figures.slice(0, MAX_BATCH_LIMIT);
    const hasMoreToProcess = figures.length > MAX_BATCH_LIMIT;
    
    console.log(`🔄 Processing batch of ${figuresToProcess.length} figures (${hasMoreToProcess ? 'more batches needed' : 'final batch'})`);

    // Update processing status to continue from where we left off
    await supabase
      .from('processing_status')
      .upsert({
        manual_id,
        job_id: `caption-${manual_id}-${Date.now()}`,
        status: 'processing',
        stage: 'caption_generation',
        current_task: `Processing batch: ${alreadyCaptioned}/${total} complete`,
        total_figures: total,
        figures_processed: alreadyCaptioned,
        progress_percent: Math.round((alreadyCaptioned / total) * 100),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'manual_id'
      });

    // Process synchronously (no background task)
    const processBatch = async () => {
      const BATCH_SIZE = 5;
      let batchProcessed = 0;
      let succeeded = 0;
      let failed = 0;

      // Process in batches of 5
      for (let i = 0; i < figuresToProcess.length; i += BATCH_SIZE) {
        const batch = figuresToProcess.slice(i, i + BATCH_SIZE);

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

            let captionText = figure.caption_text;
            let ocrText = figure.ocr_text;

            // Generate caption if missing
            if (!captionText) {
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
              captionText = captionData.choices[0].message.content;
            }

            // Extract OCR text if missing
            if (!ocrText) {
              const ocrResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openaiApiKey}`,
                  'OpenAI-Project': openaiProjectId,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o',
                  max_tokens: 1000,
                  messages: [
                    {
                      role: 'system',
                      content: 'You are an OCR system. Extract ALL visible text from the image exactly as shown. Include labels, numbers, values, units, headings, and any other text. Preserve formatting and spacing where possible.'
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: 'Extract all visible text from this image. Include every word, number, label, and value you can see.'
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

              if (!ocrResponse.ok) {
                const errorText = await ocrResponse.text();
                console.error(`OCR API error for figure ${figure.id}: ${ocrResponse.status} - ${errorText}`);
                
                if (errorText.includes('invalid_image_url') || errorText.includes('Error while downloading')) {
                  console.log(`⚠️ Skipping figure ${figure.id} - image not accessible`);
                  return { 
                    success: false, 
                    image_name: figure.image_name,
                    error: 'Image not accessible'
                  };
                }
                
                throw new Error(`OCR API error: ${ocrResponse.status} - ${errorText.substring(0, 200)}`);
              }

              const ocrData = await ocrResponse.json();
              ocrText = ocrData.choices[0].message.content;
            }

            // Generate embedding from combined caption + OCR text
            let embedding = null;
            const combinedText = `${captionText}\n\n${ocrText}`;

            if (combinedText.trim().length > 0) {
              const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openaiApiKey}`,
                  'OpenAI-Project': openaiProjectId,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'text-embedding-3-small',
                  input: combinedText.substring(0, 8000)
                })
              });

              if (embeddingResponse.ok) {
                const embeddingData = await embeddingResponse.json();
                embedding = embeddingData.data[0].embedding;
              }
            }

            // Update figure with caption, OCR, embedding, and mark as completed
            const { error: updateError } = await supabase
              .from('figures')
              .update({
                caption_text: captionText,
                ocr_text: ocrText,
                embedding_text: embedding,
                ocr_status: 'success',
                ocr_updated_at: new Date().toISOString()
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

        console.log(`📊 Progress: ${totalProcessed}/${total} captions+OCR (this batch: ${batchProcessed}/${figuresToProcess.length}, ✅ ${succeeded} success, ❌ ${failed} failed)`);
      }

      return { succeeded, failed, totalProcessed: alreadyCaptioned + succeeded };
    };

    // Process the batch synchronously
    const result = await processBatch();
    const finalProcessed = result.totalProcessed;
    
    // Check if there are more figures to process
    if (hasMoreToProcess) {
      console.log(`🔄 More figures remaining. Self-invoking for next batch...`);
      
      // Self-invoke to process the next batch
      supabase.functions.invoke('process-figure-captions', {
        body: { manual_id }
      }).then(response => {
        if (response.error) {
          console.error('❌ Self-invocation failed:', response.error);
        } else {
          console.log('✅ Next batch invoked successfully');
        }
      }).catch(err => {
        console.error('❌ Self-invocation error:', err);
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Batch complete, continuing...`,
          batch_processed: figuresToProcess.length,
          total_processed: finalProcessed,
          total: total,
          remaining: figures.length - figuresToProcess.length,
          status: 'processing'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // All done! Mark as complete
      console.log(`🎉 All figures processed! Total: ${finalProcessed}/${total}`);
      
      await supabase
        .from('processing_status')
        .update({
          status: 'completed',
          stage: 'caption_complete',
          figures_processed: finalProcessed,
          progress_percent: 100,
          current_task: `Completed: ${finalProcessed}/${total} figures with captions+OCR`,
          updated_at: new Date().toISOString()
        })
        .eq('manual_id', manual_id);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All figures captioned and OCR complete',
          total_processed: finalProcessed,
          total: total,
          status: 'completed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
