import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Chunking configuration
const CHUNK_SIZE = 400; // Target 350-450 chars
const CHUNK_OVERLAP = 125; // 100-150 chars overlap

interface ChunkData {
  manual_id: string;
  content: string;
  page_start: number;
  page_end: number;
  section_heading?: string;
  fec_tenant_id: string;
}

interface FigureData {
  id: string;
  manual_id: string;
  page_number: number;
  storage_url: string;
  ocr_text?: string;
  caption_text?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { manual_id } = await req.json();
    
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

    console.log(`🔄 Starting re-ingestion for manual: ${manual_id}`);

    // Step 1: Get current max page and set page_count in manual_metadata
    console.log('📊 Step 1: Setting page_count in manual_metadata');
    const { data: maxPageData } = await supabase
      .from('chunks_text')
      .select('page_end')
      .eq('manual_id', manual_id)
      .order('page_end', { ascending: false })
      .limit(1)
      .single();

    const pageCount = maxPageData?.page_end || 50; // Fallback to 50 if no chunks

    const { data: metadataUpdate } = await supabase
      .from('manual_metadata')
      .update({ page_count: pageCount })
      .eq('manual_id', manual_id)
      .select()
      .single();

    console.log(`✅ Set page_count to ${pageCount}`);

    // Get tenant context
    const fecTenantId = metadataUpdate?.manual_id 
      ? (await supabase.from('documents').select('fec_tenant_id').eq('manual_id', manual_id).single()).data?.fec_tenant_id
      : null;

    if (!fecTenantId) {
      throw new Error('Could not determine fec_tenant_id for manual');
    }

    // Step 2: Fetch all existing chunks to re-process
    console.log('📖 Step 2: Fetching existing chunks');
    const { data: oldChunks } = await supabase
      .from('chunks_text')
      .select('content, page_start, page_end, section_heading')
      .eq('manual_id', manual_id)
      .order('page_start', { ascending: true });

    if (!oldChunks || oldChunks.length === 0) {
      throw new Error('No chunks found to re-process');
    }

    console.log(`Found ${oldChunks.length} old chunks`);

    // Step 3: Re-chunk with new parameters
    console.log('✂️ Step 3: Re-chunking with validation (350-450 chars, 100-150 overlap)');
    const newChunks: ChunkData[] = [];
    
    for (const chunk of oldChunks) {
      const text = chunk.content;
      const pageStart = chunk.page_start;
      const pageEnd = chunk.page_end;
      const sectionHeading = chunk.section_heading;

      // Validate page numbers
      if (!pageStart || !pageEnd || pageStart > pageCount || pageEnd > pageCount) {
        console.warn(`⚠️ Skipping chunk with invalid pages: ${pageStart}-${pageEnd} (max: ${pageCount})`);
        continue;
      }

      // Split into smaller chunks
      let offset = 0;
      while (offset < text.length) {
        const chunkText = text.slice(offset, offset + CHUNK_SIZE);
        
        if (chunkText.trim().length < 50) {
          break; // Skip tiny chunks
        }

        newChunks.push({
          manual_id,
          content: chunkText,
          page_start: pageStart,
          page_end: pageEnd,
          section_heading: sectionHeading || undefined,
          fec_tenant_id: fecTenantId,
        });

        offset += CHUNK_SIZE - CHUNK_OVERLAP;
      }
    }

    console.log(`✅ Created ${newChunks.length} validated chunks`);

    // Step 4: Generate embeddings for new chunks
    console.log('🔢 Step 4: Generating embeddings for chunks');
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

        if (!embeddingResponse.ok) {
          console.error(`Failed to generate embedding for chunk ${i}`);
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        chunksWithEmbeddings.push({
          ...chunk,
          embedding: `[${embedding.join(',')}]`,
        });

        if ((i + 1) % 10 === 0) {
          console.log(`Processed ${i + 1}/${newChunks.length} chunks`);
        }

        // Rate limit: ~10 requests/sec
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error embedding chunk ${i}:`, error);
      }
    }

    // Step 5: Delete old chunks and insert new ones
    console.log('🗑️ Step 5: Replacing old chunks with new validated chunks');
    const { error: deleteError } = await supabase
      .from('chunks_text')
      .delete()
      .eq('manual_id', manual_id);

    if (deleteError) {
      throw new Error(`Failed to delete old chunks: ${deleteError.message}`);
    }

    // Insert in batches of 100
    for (let i = 0; i < chunksWithEmbeddings.length; i += 100) {
      const batch = chunksWithEmbeddings.slice(i, i + 100);
      const { error: insertError } = await supabase
        .from('chunks_text')
        .insert(batch);

      if (insertError) {
        console.error(`Failed to insert chunk batch ${i}:`, insertError);
      }
    }

    console.log(`✅ Inserted ${chunksWithEmbeddings.length} new chunks`);

    // Step 6: Re-embed figures with better captions
    console.log('🖼️ Step 6: Re-embedding figures with ±2 page caption context');
    const { data: figures } = await supabase
      .from('figures')
      .select('id, manual_id, page_number, storage_url, ocr_text, caption_text')
      .eq('manual_id', manual_id)
      .not('page_number', 'is', null);

    if (figures && figures.length > 0) {
      console.log(`Found ${figures.length} figures to re-embed`);
      
      for (let i = 0; i < figures.length; i++) {
        const figure = figures[i];
        
        // Validate page number
        if (figure.page_number > pageCount) {
          console.warn(`⚠️ Skipping figure on invalid page ${figure.page_number} (max: ${pageCount})`);
          continue;
        }

        // Get context from ±2 pages
        const { data: contextChunks } = await supabase
          .from('chunks_text')
          .select('content, section_heading')
          .eq('manual_id', manual_id)
          .gte('page_start', Math.max(1, figure.page_number - 2))
          .lte('page_end', Math.min(pageCount, figure.page_number + 2))
          .limit(5);

        const contextText = contextChunks?.map(c => c.section_heading || c.content.slice(0, 100)).join(' ') || '';
        const embeddingText = `${figure.caption_text || ''} ${figure.ocr_text || ''} ${contextText}`.trim();

        if (embeddingText.length < 10) {
          continue;
        }

        try {
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: embeddingText.slice(0, 8000), // OpenAI limit
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
          }

          if ((i + 1) % 10 === 0) {
            console.log(`Processed ${i + 1}/${figures.length} figures`);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error embedding figure ${figure.id}:`, error);
        }
      }

      console.log(`✅ Re-embedded ${figures.length} figures`);
    }

    // Step 7: Backfill metadata
    console.log('📝 Step 7: Backfilling chunk metadata');
    const { data: backfillResult } = await supabase
      .rpc('fn_backfill_for_manual_any', { p_manual_id: manual_id });

    console.log(`✅ Backfilled metadata:`, backfillResult);

    return new Response(
      JSON.stringify({
        success: true,
        manual_id,
        page_count: pageCount,
        chunks_created: chunksWithEmbeddings.length,
        figures_reembedded: figures?.length || 0,
        metadata_backfilled: backfillResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
