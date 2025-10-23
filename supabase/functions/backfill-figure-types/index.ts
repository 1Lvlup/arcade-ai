import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get auth user and their tenant
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.fec_tenant_id) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await supabase.rpc('set_tenant_context', { p_tenant_id: profile.fec_tenant_id });

    const { manual_id } = await req.json();

    // Get figures without figure_type for this manual
    const { data: figures, error: fetchError } = await supabase
      .from('figures')
      .select('id, storage_url, page_number, ocr_text, caption_text')
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
      .is('figure_type', null)
      .not('storage_url', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch figures: ${fetchError.message}`);
    }

    if (!figures || figures.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No figures need processing',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔄 Processing ${figures.length} figures for manual ${manual_id}`);

    let processed = 0;
    let errors = 0;

    // Process in batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < figures.length; i += BATCH_SIZE) {
      const batch = figures.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (fig) => {
        try {
          const visionPrompt = `Analyze this technical diagram/image. Return ONLY a JSON object (no markdown, no explanation) with:
{
  "figure_type": "diagram|photo|illustration|schematic|circuit|exploded_view|chart|table|mixed|text|sectionheader",
  "detected_components": [{"type": "part_number|measurement|callout", "label": "...", "value": "..."}],
  "semantic_tags": ["electrical", "mechanical", "troubleshooting", "assembly", "safety"]
}

CRITICAL: 
- Use "text" or "sectionheader" ONLY for purely textual images with NO diagrams/photos/illustrations
- For tables with many rows, limit to first 5-10 most important items
- Return ONLY the JSON object, no other text`;

          const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1-mini',
              max_completion_tokens: 2000,  // Increased from 500 to handle large tables
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: visionPrompt },
                    { type: 'image_url', image_url: { url: fig.storage_url } }
                  ]
                }
              ],
            }),
          });

          if (!visionResponse.ok) {
            console.error(`Vision API error for figure ${fig.id}: ${visionResponse.status}`);
            errors++;
            return;
          }

          const visionData = await visionResponse.json();
          const visionContent = visionData.choices[0].message.content;
          
          console.log(`📥 Raw response for ${fig.id}:`, visionContent.substring(0, 300));
          
          let visionMetadata: any = {};
          
          // Try to extract figure_type even from incomplete JSON
          const typeMatch = visionContent.match(/"figure_type"\s*:\s*"([^"]+)"/);
          if (typeMatch) {
            visionMetadata.figure_type = typeMatch[1];
          }
          
          // Try to extract semantic_tags
          const tagsMatch = visionContent.match(/"semantic_tags"\s*:\s*\[(.*?)\]/);
          if (tagsMatch) {
            try {
              visionMetadata.semantic_tags = JSON.parse(`[${tagsMatch[1]}]`);
            } catch {
              visionMetadata.semantic_tags = [];
            }
          }
          
          // Try full JSON parse for complete responses
          try {
            const fullParse = JSON.parse(visionContent);
            visionMetadata = { ...visionMetadata, ...fullParse };
          } catch {
            // Try markdown extraction
            const jsonMatch = visionContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
            if (jsonMatch && jsonMatch[1]) {
              try {
                const fullParse = JSON.parse(jsonMatch[1].trim());
                visionMetadata = { ...visionMetadata, ...fullParse };
              } catch {
                // Partial data is OK - we at least have figure_type
              }
            }
          }
          
          // If we don't have at least figure_type, fail
          if (!visionMetadata.figure_type) {
            console.error(`❌ No figure_type found for ${fig.id}`);
            errors++;
            return;
          }

          // Update figure with metadata
          const { error: updateError } = await supabase
            .from('figures')
            .update({
              figure_type: visionMetadata.figure_type || 'diagram',
              detected_components: visionMetadata.detected_components || [],
              semantic_tags: visionMetadata.semantic_tags || [],
            })
            .eq('id', fig.id);

          if (updateError) {
            console.error(`DB update error for figure ${fig.id}:`, updateError);
            errors++;
            return;
          }

          processed++;
          console.log(`✅ [${processed}/${figures.length}] Updated figure ${fig.id} -> ${visionMetadata.figure_type}`);

        } catch (error) {
          console.error(`Error processing figure ${fig.id}:`, error);
          errors++;
        }
      }));

      // Rate limiting: wait 1 second between batches
      if (i + BATCH_SIZE < figures.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      manual_id,
      total: figures.length,
      processed,
      errors,
      message: `Processed ${processed}/${figures.length} figures (${errors} errors)`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
