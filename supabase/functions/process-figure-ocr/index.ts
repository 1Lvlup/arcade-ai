import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "jsr:@supabase/supabase-js@2";

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

    console.log(`🔍 Processing OCR for manual: ${manual_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const openaiProjectId = Deno.env.get('OPENAI_PROJECT_ID');

    if (!openaiApiKey || !openaiProjectId) {
      throw new Error('OpenAI credentials not configured');
    }

    // Get all figures without OCR for this manual
    const { data: figures, error: fetchError } = await supabase
      .from('figures')
      .select('id, storage_url, caption_text, page_number, image_name')
      .eq('manual_id', manual_id)
      .is('ocr_text', null)
      .order('page_number', { ascending: true });

    if (fetchError) throw fetchError;

    if (!figures || figures.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All figures already have OCR',
          processed: 0,
          total: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${figures.length} figures needing OCR`);

    const BATCH_SIZE = 5;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < figures.length; i += BATCH_SIZE) {
      const batch = figures.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(batch.map(async (figure) => {
        try {
          // Call GPT-4.1 Vision for OCR
          const ocrResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'OpenAI-Project': openaiProjectId,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1',
              max_completion_tokens: 1000,
              messages: [
                {
                  role: 'system',
                  content: 'You are an OCR specialist. Extract ALL visible text from images with 100% accuracy. Preserve exact text, formatting, labels, part numbers, model numbers, voltage ratings, warnings, and any other written content. Return ONLY the extracted text without commentary.'
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Extract all visible text from this image. Include labels, part numbers, specifications, warnings, and any other text. Preserve the original formatting.'
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
            throw new Error(`OCR API error: ${ocrResponse.status}`);
          }

          const ocrData = await ocrResponse.json();
          const ocrText = ocrData.choices[0].message.content;

          // Regenerate embedding with caption + OCR
          const combinedText = `${figure.caption_text || ''}\n\n${ocrText}`.trim();
          let embedding = null;

          if (combinedText.length > 0) {
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

          // Update figure with OCR and new embedding
          const { error: updateError } = await supabase
            .from('figures')
            .update({
              ocr_text: ocrText,
              embedding_text: embedding,
              ocr_status: 'completed',
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
        processed++;
        if (result.status === 'fulfilled' && result.value.success) {
          succeeded++;
        } else {
          failed++;
        }
      });

      console.log(`📊 Progress: ${processed}/${figures.length} (✅ ${succeeded} success, ❌ ${failed} failed)`);
    }

    console.log(`🎉 OCR processing complete: ${succeeded}/${figures.length} figures processed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: succeeded,
        failed: failed,
        total: figures.length
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
