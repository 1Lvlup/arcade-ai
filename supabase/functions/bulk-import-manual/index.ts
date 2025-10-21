import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChunkData {
  content: string;
  page_start?: number;
  page_end?: number;
  menu_path?: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

interface FigureData {
  image_name: string;
  page_number: number;
  caption_text?: string;
  ocr_text?: string;
  figure_type?: string;
  kind?: string;
  semantic_tags?: string[];
  keywords?: string[];
  detected_components?: Record<string, any>;
  quality_score?: number;
  storage_path?: string;
  embedding_text?: number[];
  [key: string]: any;
}

interface ImportRequest {
  manual_id: string;
  chunks: ChunkData[];
  figures?: FigureData[];
  metadata?: {
    canonical_title?: string;
    platform?: string;
    manufacturer?: string;
    doc_type?: string;
    version?: string;
    tags?: string[];
    page_count?: number;
    [key: string]: any;
  };
  images?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single();

    const tenantId = profile?.fec_tenant_id;
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant ID not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set tenant context for RLS
    await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    const { manual_id, chunks, figures, metadata, images }: ImportRequest = await req.json();

    console.log(`Starting bulk import for manual: ${manual_id}`);
    console.log(`Chunks to import: ${chunks.length}, Figures: ${figures?.length || 0}, Images: ${images || 0}`);

    // 1. Create/update manual metadata
    if (metadata && metadata.canonical_title) {
      const metadataPayload = {
        manual_id,
        canonical_title: metadata.canonical_title,
        platform: metadata.platform || 'Unknown',
        manufacturer: metadata.manufacturer,
        doc_type: metadata.doc_type || 'manual',
        version: metadata.version || 'v1',
        tags: metadata.tags || [],
        page_count: metadata.page_count || 0,
        ingest_status: 'imported',
        uploaded_by: user.email
      };

      const { error: metaError } = await supabase.rpc('upsert_manual_metadata', {
        p_metadata: metadataPayload
      });

      if (metaError) {
        console.error('Metadata upsert error:', metaError);
        throw new Error(`Failed to create metadata: ${metaError.message}`);
      }
    }

    // 2. Create document entry
    const { error: docError } = await supabase
      .from('documents')
      .upsert({
        manual_id,
        title: metadata?.canonical_title || manual_id,
        fec_tenant_id: tenantId,
        source_filename: `${manual_id}.pdf`
      }, {
        onConflict: 'manual_id,fec_tenant_id'
      });

    if (docError) {
      console.error('Document upsert error:', docError);
      throw new Error(`Failed to create document: ${docError.message}`);
    }

    // 3. Import chunks
    let chunksCreated = 0;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    for (const chunk of chunks) {
      try {
        // Generate embedding if not provided
        let embedding = chunk.embedding;
        
        if (!embedding && openaiKey && chunk.content) {
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: chunk.content.slice(0, 8000), // Limit to 8k chars
            }),
          });

          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json();
            embedding = embeddingData.data[0].embedding;
          }
        }

        // Merge metadata
        const chunkMetadata = {
          ...(metadata || {}),
          ...(chunk.metadata || {}),
          game_title: metadata?.canonical_title || manual_id
        };

        const { error: chunkError } = await supabase
          .from('chunks_text')
          .insert({
            manual_id,
            content: chunk.content,
            page_start: chunk.page_start,
            page_end: chunk.page_end,
            menu_path: chunk.menu_path,
            embedding: embedding,
            metadata: chunkMetadata,
            fec_tenant_id: tenantId
          });

        if (chunkError) {
          console.error('Chunk insert error:', chunkError);
        } else {
          chunksCreated++;
        }
      } catch (chunkErr) {
        console.error('Error processing chunk:', chunkErr);
      }
    }

    // 4. Import figures with metadata
    let figuresCreated = 0;
    if (figures && figures.length > 0) {
      for (const figure of figures) {
        try {
          // Generate embedding for caption+OCR if not provided
          let embedding = figure.embedding_text;
          
          if (!embedding && openaiKey) {
            const textToEmbed = [figure.caption_text, figure.ocr_text].filter(Boolean).join('\n\n');
            if (textToEmbed) {
              const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openaiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'text-embedding-3-small',
                  input: textToEmbed.slice(0, 8000),
                }),
              });

              if (embeddingResponse.ok) {
                const embeddingData = await embeddingResponse.json();
                embedding = embeddingData.data[0].embedding;
              }
            }
          }

          const storage_path = figure.storage_path || `${manual_id}/${figure.image_name}`;
          const storage_url = `${supabaseUrl}/storage/v1/object/public/postparse/${storage_path}`;

          const { error: figError } = await supabase
            .from('figures')
            .insert({
              manual_id,
              image_name: figure.image_name,
              page_number: figure.page_number,
              caption_text: figure.caption_text,
              ocr_text: figure.ocr_text,
              figure_type: figure.figure_type,
              kind: figure.kind || 'diagram',
              semantic_tags: figure.semantic_tags,
              keywords: figure.keywords,
              detected_components: figure.detected_components,
              quality_score: figure.quality_score,
              storage_path,
              storage_url,
              embedding_text: embedding,
              ocr_status: figure.ocr_text ? 'completed' : 'pending',
              fec_tenant_id: tenantId
            });

          if (figError) {
            console.error('Figure insert error:', figError);
          } else {
            figuresCreated++;
          }
        } catch (figErr) {
          console.error('Error processing figure:', figErr);
        }
      }
    }

    // 5. Create tenant manual access
    const { error: accessError } = await supabase
      .from('tenant_manual_access')
      .upsert({
        fec_tenant_id: tenantId,
        manual_id
      }, {
        onConflict: 'fec_tenant_id,manual_id'
      });

    if (accessError) {
      console.error('Access upsert error:', accessError);
    }

    const result = {
      manual_id,
      chunks_created: chunksCreated,
      total_chunks: chunks.length,
      figures_created: figuresCreated,
      total_figures: figures?.length || 0,
      images_expected: images || 0,
      status: 'success'
    };

    console.log('Import complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bulk import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
