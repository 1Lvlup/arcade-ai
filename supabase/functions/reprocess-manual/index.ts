import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
      return new Response(
        JSON.stringify({ error: 'manual_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Set tenant context
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set tenant context
    await supabase.rpc('set_tenant_context', { p_tenant_id: profile.fec_tenant_id });

    console.log(`Reprocessing manual: ${manual_id}`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Get all figures needing processing
    const { data: figures, error: figuresError } = await supabase
      .from('figures')
      .select('id, storage_url, caption_text, ocr_text, manual_id, page_number')
      .eq('manual_id', manual_id)
      .or('detected_components.is.null,vision_metadata.is.null');

    if (figuresError) throw figuresError;

    console.log(`Found ${figures?.length || 0} figures to process`);

    let processedFigures = 0;
    let figureErrors = 0;

    // Process figures with GPT-4 Vision
    for (const fig of figures || []) {
      try {
        if (!fig.storage_url) continue;

        const visionPrompt = `Analyze this technical diagram/image. Extract:
1. figure_type: (diagram, photo, table, circuit, schematic, flowchart, other)
2. detected_components: Array of objects with {type, label, value} for any visible:
   - Part numbers
   - Measurements (with units)
   - Callouts/labels
   - Wire colors
   - Safety symbols
   - Component identifiers
3. semantic_tags: Array of category keywords (electrical, mechanical, troubleshooting, assembly, safety, etc.)
4. technical_complexity: (low, medium, high)
5. has_table: boolean
6. notes: Any important observations

Return as JSON only.`;

        const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: visionPrompt },
                  { type: 'image_url', image_url: { url: fig.storage_url } }
                ]
              }
            ],
            max_tokens: 1000
          }),
        });

        if (!visionResponse.ok) {
          console.error(`Vision API error for figure ${fig.id}: ${visionResponse.status}`);
          figureErrors++;
          continue;
        }

        const visionData = await visionResponse.json();
        const visionContent = visionData.choices[0].message.content;
        
        let visionMetadata;
        try {
          visionMetadata = JSON.parse(visionContent);
        } catch {
          console.error(`Failed to parse vision response for figure ${fig.id}`);
          figureErrors++;
          continue;
        }

        // Update figure with vision metadata
        const { error: updateError } = await supabase
          .from('figures')
          .update({
            figure_type: visionMetadata.figure_type || 'diagram',
            detected_components: visionMetadata.detected_components || [],
            semantic_tags: visionMetadata.semantic_tags || [],
            vision_metadata: {
              technical_complexity: visionMetadata.technical_complexity,
              has_table: visionMetadata.has_table,
              notes: visionMetadata.notes
            }
          })
          .eq('id', fig.id);

        if (updateError) {
          console.error(`Error updating figure ${fig.id}:`, updateError);
          figureErrors++;
        } else {
          processedFigures++;
        }

        // Rate limit: 3 requests per second for gpt-4o-mini
        await new Promise(resolve => setTimeout(resolve, 350));

      } catch (error) {
        console.error(`Error processing figure ${fig.id}:`, error);
        figureErrors++;
      }
    }

    // Get all chunks needing processing
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks_text')
      .select('id, content, manual_id')
      .eq('manual_id', manual_id)
      .or('entities.is.null,semantic_tags.is.null,quality_score.is.null');

    if (chunksError) throw chunksError;

    console.log(`Found ${chunks?.length || 0} chunks to process`);

    let processedChunks = 0;
    let chunkErrors = 0;

    // Process chunks with NER and quality scoring
    for (const chunk of chunks || []) {
      try {
        const nerPrompt = `Extract structured entities from this technical manual text. Return JSON with:
{
  "entities": [
    {"type": "part_number", "value": "..."},
    {"type": "model_number", "value": "..."},
    {"type": "measurement", "value": "...", "unit": "..."},
    {"type": "specification", "value": "..."}
  ],
  "semantic_tags": ["category1", "category2"],
  "quality_score": 0.0-1.0 (based on clarity, completeness, technical detail)
}

Text: ${chunk.content.substring(0, 2000)}`;

        const nerResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: nerPrompt }],
            max_tokens: 500
          }),
        });

        if (!nerResponse.ok) {
          console.error(`NER API error for chunk ${chunk.id}: ${nerResponse.status}`);
          chunkErrors++;
          continue;
        }

        const nerData = await nerResponse.json();
        const nerContent = nerData.choices[0].message.content;
        
        let nerMetadata;
        try {
          nerMetadata = JSON.parse(nerContent);
        } catch {
          console.error(`Failed to parse NER response for chunk ${chunk.id}`);
          chunkErrors++;
          continue;
        }

        // Update chunk with NER metadata
        const { error: updateError } = await supabase
          .from('chunks_text')
          .update({
            entities: nerMetadata.entities || [],
            semantic_tags: nerMetadata.semantic_tags || [],
            quality_score: nerMetadata.quality_score || 0.5
          })
          .eq('id', chunk.id);

        if (updateError) {
          console.error(`Error updating chunk ${chunk.id}:`, updateError);
          chunkErrors++;
        } else {
          processedChunks++;
        }

        // Rate limit: 3 requests per second
        await new Promise(resolve => setTimeout(resolve, 350));

      } catch (error) {
        console.error(`Error processing chunk ${chunk.id}:`, error);
        chunkErrors++;
      }
    }

    const result = {
      manual_id,
      figures: {
        total: figures?.length || 0,
        processed: processedFigures,
        errors: figureErrors
      },
      chunks: {
        total: chunks?.length || 0,
        processed: processedChunks,
        errors: chunkErrors
      },
      status: 'completed'
    };

    console.log('Reprocessing complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Reprocess error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
