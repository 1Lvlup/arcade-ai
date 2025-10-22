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
      .from('manual_documents')
      .select('title, description')
      .eq('manual_id', manual_id)
      .single();

    // Get all figures without captions for this manual
    const { data: figures, error: fetchError } = await supabase
      .from('figures')
      .select('id, storage_url, page_number, image_name')
      .eq('manual_id', manual_id)
      .is('caption_text', null)
      .order('page_number', { ascending: true });

    if (fetchError) throw fetchError;

    if (!figures || figures.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All figures already have captions',
          processed: 0,
          total: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${figures.length} figures needing captions`);

    const BATCH_SIZE = 5;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < figures.length; i += BATCH_SIZE) {
      const batch = figures.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(batch.map(async (figure) => {
        try {
          // Generate caption using GPT-4.1 Vision
          const captionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'OpenAI-Project': openaiProjectId,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1',
              max_completion_tokens: 500,
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
            throw new Error(`Caption API error: ${captionResponse.status}`);
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
        processed++;
        if (result.status === 'fulfilled' && result.value.success) {
          succeeded++;
        } else {
          failed++;
        }
      });

      console.log(`📊 Progress: ${processed}/${figures.length} (✅ ${succeeded} success, ❌ ${failed} failed)`);
    }

    console.log(`🎉 Caption processing complete: ${succeeded}/${figures.length} figures processed`);

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
