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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { manual_id, image_paths } = await req.json();

    console.log(`🔍 Starting batch OCR for ${image_paths.length} images in manual: ${manual_id}`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const VLM_ENDPOINT = Deno.env.get('VLM_ENDPOINT') || 'https://api.openai.com/v1/chat/completions';

    let processed = 0;
    let errors = 0;

    for (const imagePath of image_paths) {
      try {
        // Get the image from storage
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('postparse')
          .download(imagePath);

        if (downloadError) {
          console.error(`Failed to download ${imagePath}:`, downloadError);
          errors++;
          continue;
        }

        // Convert to base64
        const arrayBuffer = await imageData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // Call vision model for OCR + caption
        const visionResponse = await fetch(VLM_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this arcade game service manual image. Extract: 1) All visible text (OCR), 2) A technical caption describing what the image shows, 3) Key components visible, 4) Any connector labels or voltage markings. Format as JSON with keys: ocr_text, caption, components, connectors, voltages.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64}`
                  }
                }
              ]
            }],
            max_tokens: 1000
          })
        });

        if (!visionResponse.ok) {
          console.error(`Vision API error for ${imagePath}:`, await visionResponse.text());
          errors++;
          continue;
        }

        const visionData = await visionResponse.json();
        const content = visionData.choices[0].message.content;
        
        // Parse JSON response
        let metadata: any = {};
        try {
          metadata = JSON.parse(content);
        } catch {
          // If not JSON, treat as plain text
          metadata = { ocr_text: content, caption: '', components: [], connectors: [], voltages: [] };
        }

        // Generate embedding for combined text
        const combinedText = `${metadata.caption || ''}\n${metadata.ocr_text || ''}`.trim();
        
        let embedding = null;
        if (combinedText) {
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: combinedText,
              model: 'text-embedding-3-small',
            }),
          });

          if (embeddingResponse.ok) {
            const embData = await embeddingResponse.json();
            embedding = embData.data[0].embedding;
          }
        }

        // Update figure in database
        const { error: updateError } = await supabase
          .from('figures')
          .update({
            ocr_text: metadata.ocr_text || null,
            caption_text: metadata.caption || null,
            detected_components: {
              components: metadata.components || [],
              connectors: metadata.connectors || [],
              voltages: metadata.voltages || []
            },
            embedding_text: embedding,
            ocr_status: 'success',
            ocr_updated_at: new Date().toISOString()
          })
          .eq('manual_id', manual_id)
          .eq('storage_path', imagePath);

        if (updateError) {
          console.error(`Failed to update figure ${imagePath}:`, updateError);
          errors++;
        } else {
          processed++;
          console.log(`✅ Processed ${processed}/${image_paths.length}: ${imagePath}`);
        }

      } catch (error: any) {
        console.error(`Error processing ${imagePath}:`, error);
        errors++;
      }
    }

    console.log(`🎉 Batch OCR complete: ${processed} successful, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        total: image_paths.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Batch OCR error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
