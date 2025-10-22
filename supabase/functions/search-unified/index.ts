import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const COHERE_API_KEY = Deno.env.get('COHERE_API_KEY')!;

// Create embedding using OpenAI
async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small',
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Rerank results using Cohere
async function rerankResults(query: string, documents: any[]): Promise<any[]> {
  if (!COHERE_API_KEY || documents.length === 0) {
    console.log('⚠️ Skipping reranking: no API key or no documents');
    return documents;
  }

  try {
    const docs = documents.map(d => ({
      text: d.content.substring(0, 1500) // Cohere limit
    }));

    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-english-v3.0',
        query: query,
        documents: docs,
        top_n: Math.min(10, documents.length),
        return_documents: false,
      }),
    });

    if (!response.ok) {
      console.error('❌ Cohere rerank failed:', response.status);
      return documents;
    }

    const data = await response.json();
    
    // Map reranked indices back to original documents with scores
    const reranked = data.results.map((result: any) => ({
      ...documents[result.index],
      rerank_score: result.relevance_score,
    }));

    console.log(`✅ Reranked ${reranked.length} results (top score: ${reranked[0]?.rerank_score?.toFixed(3)})`);
    return reranked;
  } catch (error) {
    console.error('❌ Reranking error:', error);
    return documents;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, manual_id, tenant_id, top_k = 60 } = await req.json();

    if (!query) {
      throw new Error('Query is required');
    }

    console.log(`🔍 Unified search: "${query}" (manual: ${manual_id || 'all'})`);

    // Create Supabase client
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: authHeader ? { authorization: authHeader } : {},
      },
    });

    // Set tenant context if provided
    if (tenant_id) {
      await supabase.rpc('set_tenant_context', { tenant_id });
    }

    // Generate embedding
    const embedding = await createEmbedding(query);
    console.log(`📊 Generated embedding (${embedding.length} dims)`);

    // Search using unified function (text chunks + figures)
    const { data: rawResults, error: searchError } = await supabase.rpc(
      'match_chunks_improved',
      {
        query_embedding: embedding,
        top_k: top_k,
        min_score: 0.25, // Lower threshold to get more candidates for reranking
        manual: manual_id || null,
        tenant_id: tenant_id || null,
      }
    );

    if (searchError) {
      throw searchError;
    }

    console.log(`📦 Retrieved ${rawResults?.length || 0} candidates`);

    // Log breakdown of content types
    const textCount = rawResults?.filter(r => r.content_type === 'text').length || 0;
    const figureCount = rawResults?.filter(r => r.content_type === 'figure').length || 0;
    console.log(`📊 Content breakdown: ${textCount} text chunks, ${figureCount} figures`);
    
    if (figureCount > 0) {
      console.log(`🖼️ Figures retrieved:`, rawResults
        ?.filter(r => r.content_type === 'figure')
        .slice(0, 3)
        .map(f => `p${f.page_start} (score: ${f.score?.toFixed(3)})`)
        .join(', '));
    }

    if (!rawResults || rawResults.length === 0) {
      return new Response(
        JSON.stringify({
          results: [],
          count: 0,
          strategy: 'vector_search',
          message: 'No results found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rerank with Cohere
    const reranked = await rerankResults(query, rawResults);

    // Take top 10 after reranking
    const finalResults = reranked.slice(0, 10);
    
    // Log final content type breakdown
    const finalTextCount = finalResults.filter(r => r.content_type === 'text').length;
    const finalFigureCount = finalResults.filter(r => r.content_type === 'figure').length;
    console.log(`✅ Final results: ${finalTextCount} text chunks, ${finalFigureCount} figures`);

    console.log(`✅ Returning ${finalResults.length} results (vector → rerank)`);

    return new Response(
      JSON.stringify({
        results: finalResults,
        count: finalResults.length,
        total_candidates: rawResults.length,
        strategy: 'vector_rerank',
        reranked: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Search error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
