import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 125;

interface ChunkData {
  manual_id: string;
  content: string;
  page_start: number;
  page_end: number;
  section_heading?: string;
  fec_tenant_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { manual_id, step } = await req.json();
    
    if (!manual_id) {
      throw new Error('manual_id is required');
    }

    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader || '' } }
    });

    // STEP 1: Set page_count and re-chunk
    if (!step || step === 'chunks') {
      console.log(`🔄 Step 1: Re-chunking for manual: ${manual_id}`);

      const { data: maxPageData } = await supabase
        .from('chunks_text')
        .select('page_end')
        .eq('manual_id', manual_id)
        .order('page_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      const pageCount = maxPageData?.page_end || 48;

      await supabase
        .from('manual_metadata')
        .update({ page_count: pageCount })
        .eq('manual_id', manual_id);

      console.log(`✅ Set page_count to ${pageCount}`);

      const { data: doc } = await supabase
        .from('documents')
        .select('fec_tenant_id')
        .eq('manual_id', manual_id)
        .maybeSingle();

      const fecTenantId = doc?.fec_tenant_id;
      if (!fecTenantId) throw new Error('Could not determine fec_tenant_id');

      const { data: oldChunks } = await supabase
        .from('chunks_text')
        .select('content, page_start, page_end, section_heading')
        .eq('manual_id', manual_id)
        .order('page_start', { ascending: true });

      if (!oldChunks || oldChunks.length === 0) {
        throw new Error('No chunks found');
      }

      const newChunks: ChunkData[] = [];
      
      for (const chunk of oldChunks) {
        const text = chunk.content;
        const pageStart = chunk.page_start;
        const pageEnd = chunk.page_end;

        if (!pageStart || !pageEnd || pageStart > pageCount || pageEnd > pageCount) {
          console.warn(`⚠️ Skipping invalid pages: ${pageStart}-${pageEnd}`);
          continue;
        }

        let offset = 0;
        while (offset < text.length) {
          const chunkText = text.slice(offset, offset + CHUNK_SIZE);
          if (chunkText.trim().length < 50) break;

          newChunks.push({
            manual_id,
            content: chunkText,
            page_start: pageStart,
            page_end: pageEnd,
            section_heading: chunk.section_heading || undefined,
            fec_tenant_id: fecTenantId,
          });

          offset += CHUNK_SIZE - CHUNK_OVERLAP;
        }
      }

      console.log(`✅ Created ${newChunks.length} validated chunks`);

      const chunksWithEmbeddings = [];
      
      for (let i = 0; i < newChunks.length; i++) {
        const chunk = newChunks[i];
        
        try {
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: chunk.content,
              model: 'text-embedding-3-small',
            }),
          });

          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json();
            const embedding = embeddingData.data[0].embedding;

            chunksWithEmbeddings.push({
              ...chunk,
              embedding: `[${embedding.join(',')}]`,
            });
          }

          if ((i + 1) % 50 === 0) {
            console.log(`Processed ${i + 1}/${newChunks.length} chunks`);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error embedding chunk ${i}:`, error);
        }
      }

      await supabase.from('chunks_text').delete().eq('manual_id', manual_id);

      for (let i = 0; i < chunksWithEmbeddings.length; i += 100) {
        const batch = chunksWithEmbeddings.slice(i, i + 100);
        await supabase.from('chunks_text').insert(batch);
      }

      console.log(`✅ Inserted ${chunksWithEmbeddings.length} chunks`);

      const { data: backfillResult } = await supabase
        .rpc('fn_backfill_for_manual_any', { p_manual_id: manual_id });

      return new Response(
        JSON.stringify({
          success: true,
          step: 'chunks',
          manual_id,
          page_count: pageCount,
          chunks_created: chunksWithEmbeddings.length,
          metadata_backfilled: backfillResult,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: Re-embed figures (call separately)
    if (step === 'figures') {
      console.log(`🖼️ Step 2: Re-embedding figures for manual: ${manual_id}`);

      const { data: metadata } = await supabase
        .from('manual_metadata')
        .select('page_count')
        .eq('manual_id', manual_id)
        .maybeSingle();

      const pageCount = metadata?.page_count || 48;

      const { data: figures } = await supabase
        .from('figures')
        .select('id, manual_id, page_number, ocr_text, caption_text')
        .eq('manual_id', manual_id)
        .not('page_number', 'is', null)
        .limit(50); // Process in batches of 50

      if (!figures || figures.length === 0) {
        return new Response(
          JSON.stringify({ success: true, step: 'figures', figures_processed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let processed = 0;
      
      for (const figure of figures) {
        if (figure.page_number > pageCount) {
          console.warn(`⚠️ Skipping figure on invalid page ${figure.page_number}`);
          continue;
        }

        const { data: contextChunks } = await supabase
          .from('chunks_text')
          .select('content, section_heading')
          .eq('manual_id', manual_id)
          .gte('page_start', Math.max(1, figure.page_number - 2))
          .lte('page_end', Math.min(pageCount, figure.page_number + 2))
          .limit(5);

        const contextText = contextChunks?.map(c => c.section_heading || c.content.slice(0, 100)).join(' ') || '';
        const embeddingText = `${figure.caption_text || ''} ${figure.ocr_text || ''} ${contextText}`.trim();

        if (embeddingText.length < 10) continue;

        try {
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: embeddingText.slice(0, 8000),
              model: 'text-embedding-3-small',
            }),
          });

          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json();
            const embedding = embeddingData.data[0].embedding;

            await supabase
              .from('figures')
              .update({ embedding_text: `[${embedding.join(',')}]` })
              .eq('id', figure.id);

            processed++;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error embedding figure ${figure.id}:`, error);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          step: 'figures',
          figures_processed: processed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid step parameter');
  } catch (error: any) {
    console.error('❌ Re-ingestion error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
