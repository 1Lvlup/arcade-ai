import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BATCH_LIMIT = 100; // Process up to 100 figures per invocation
const CONCURRENT_BATCH_SIZE = 10; // Process 10 images concurrently for faster throughput

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

    // Process with higher concurrency for faster throughput
    const processBatch = async () => {
      let batchProcessed = 0;
      let succeeded = 0;
      let failed = 0;

      // Process in batches of 10 concurrently
      for (let i = 0; i < figuresToProcess.length; i += CONCURRENT_BATCH_SIZE) {
        const batch = figuresToProcess.slice(i, i + CONCURRENT_BATCH_SIZE);

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

            // Skip if both caption and OCR already exist
            if (figure.caption_text && figure.ocr_text) {
              console.log(`⏭️ Figure ${figure.id} already has caption and OCR, skipping`);
              return { success: true, image_name: figure.image_name };
            }

            // Get page context (section/headings) for better captions
            let pageContext = '';
            if (figure.page_number) {
              const { data: pageData } = await supabase
                .from('manual_pages')
                .select('section_path, headings')
                .eq('manual_id', manual_id)
                .eq('page', figure.page_number)
                .single();

              if (pageData) {
                const section = pageData.section_path?.join(' > ') || '';
                const headings = pageData.headings?.join(', ') || '';
                pageContext = `Section: ${section || 'N/A'}\nPage headings: ${headings || 'N/A'}`;
              }
            }

            // Get surrounding text chunks from ±2 pages for richer context
            let textContext = '';
            if (figure.page_number) {
              const { data: nearbyChunks } = await supabase
                .from('chunks_text')
                .select('content, page_start, section_heading')
                .eq('manual_id', manual_id)
                .gte('page_start', Math.max(1, figure.page_number - 2))
                .lte('page_end', figure.page_number + 2)
                .order('page_start', { ascending: true })
                .limit(8);

              if (nearbyChunks && nearbyChunks.length > 0) {
                textContext = nearbyChunks
                  .map(c => {
                    const header = c.section_heading ? `[${c.section_heading}]\n` : '';
                    return header + c.content;
                  })
                  .join('\n\n')
                  .substring(0, 800);
              }
            }

            const contextPrompt = pageContext || textContext 
              ? `\n\nContext from page ${figure.page_number}:\n${pageContext}\n\nNearby text: ${textContext.substring(0, 300)}...`
              : '';

            // Single combined API call for caption + OCR using gpt-4o-mini (faster & cheaper)
            const combinedResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Project': openaiProjectId,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: `You are a technical arcade technician analyzing service manual images. Generate captions that precisely describe what's visible in the image.

CRITICAL RULES:
1. CAPTION: Describe what you ACTUALLY SEE in the image - specific components, connectors, boards, parts, diagrams, or schematics. Be concrete and visual.
   - Good: "PCB board showing IC1 (Z80 processor), capacitors C1-C4, and power connector J1 at top left"
   - Good: "Wiring diagram for coin door, showing connections between microswitches, coin mech, and harness"
   - Bad: "Detailed tech description for troubleshooting/maintenance" (too vague)
   - Bad: "Image shows technical information" (not specific enough)
   
2. OCR: Extract ALL visible text, labels, part numbers exactly as they appear. If no text, return empty string.

Use the manual context to understand the purpose, but ALWAYS describe what's literally visible in the image.

Return JSON:
{
  "caption": "Concrete description of visible components/diagram...",
  "ocr_text": "All text here or empty string if no text"
}`
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: `Analyze this image from "${manual?.title || 'technical manual'}" (page ${figure.page_number || 'Unknown'}).${contextPrompt}

Generate:
1. A caption that describes EXACTLY what you see - specific components, parts, connectors, labels, or diagram elements that are visible. Be concrete and detailed about what's in the image.
2. OCR extraction of all visible text, labels, and part numbers (return empty string if no text found)

Return as JSON with "caption" and "ocr_text" fields.`
                      },
                      {
                        type: 'image_url',
                        image_url: { url: figure.storage_url }
                      }
                    ]
                  }
                ],
                response_format: { type: "json_object" },
                max_completion_tokens: 800,
                temperature: 0.3
              }),
            });

            if (!combinedResponse.ok) {
              const errorText = await combinedResponse.text();
              console.error(`Combined API error for figure ${figure.id}: ${combinedResponse.status} - ${errorText}`);
              
              if (errorText.includes('invalid_image_url') || errorText.includes('Error while downloading')) {
                console.log(`⚠️ Skipping figure ${figure.id} - image not accessible`);
                return { 
                  success: false, 
                  image_name: figure.image_name,
                  error: 'Image not accessible'
                };
              }
              
              throw new Error(`Combined API error: ${combinedResponse.status} - ${errorText.substring(0, 200)}`);
            }

            const combinedData = await combinedResponse.json();
            
            // Parse JSON response
            let parsedContent;
            try {
              const content = combinedData.choices[0]?.message?.content;
              if (!content) {
                throw new Error('No content in response');
              }
              parsedContent = JSON.parse(content);
            } catch (e) {
              console.error(`❌ Failed to parse JSON response for figure ${figure.id}:`, e);
              throw new Error('AI response was not valid JSON');
            }

            const captionText = parsedContent.caption || '';
            const ocrText = parsedContent.ocr_text || '';

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
