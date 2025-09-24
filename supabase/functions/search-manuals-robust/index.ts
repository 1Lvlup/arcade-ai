import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simple MMR (Maximal Marginal Relevance) implementation
function applyMMR(results: any[], lambda = 0.7, targetCount = 6): any[] {
  if (results.length <= targetCount) return results;
  
  const selected: any[] = [];
  const remaining = [...results];
  
  // Always pick the highest scoring first
  selected.push(remaining.shift()!);
  
  while (selected.length < targetCount && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -1;
    
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevanceScore = candidate.score || candidate.similarity || 0;
      
      // Calculate max similarity to already selected
      let maxSimilarity = 0;
      for (const selectedItem of selected) {
        // Simple text similarity (cosine on embeddings would be better)
        const similarity = textSimilarity(candidate.content, selectedItem.content);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      
      // MMR formula: λ * relevance - (1-λ) * max_similarity
      const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSimilarity;
      
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }
    
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  
  return selected;
}

// Simple text similarity for MMR
function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\W+/));
  const words2 = new Set(text2.toLowerCase().split(/\W+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

// Create embeddings
async function createEmbedding(text: string): Promise<number[]> {
  const input = text.length > 8000 ? text.slice(0, 8000) : text;
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // Match DB dimensions
      input: input
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, manual_id, max_results = 6 } = await req.json();
    
    console.log('🔍 [ROBUST-SEARCH] Starting search:', { query: query?.slice(0, 50), manual_id });
    
    if (!query) {
      throw new Error('Query is required');
    }

    // Get tenant context
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('apikey');
    let tenantId = '00000000-0000-0000-0000-000000000001'; // default
    
    if (apiKey === supabaseServiceKey) {
      console.log('🔐 Service key authenticated');
    } else if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('fec_tenant_id')
            .eq('user_id', user.id)
            .single();
            
          if (profile?.fec_tenant_id) {
            tenantId = profile.fec_tenant_id;
          }
        }
      } catch (authError) {
        console.error('Auth error:', authError);
      }
    }

    let searchResults: any[] = [];

    // STEP 1: Try vector search first (if embeddings work)
    try {
      console.log('🗄️ Trying vector search...');
      const queryEmbedding = await createEmbedding(query);
      
      const { data: vectorData, error: vectorError } = await supabase
        .rpc('match_chunks_improved', {
          query_embedding: queryEmbedding,
          top_k: max_results * 3, // Get more for reranking
          min_score: 0.3,
          manual: manual_id || null,
          tenant_id: tenantId
        });

      if (!vectorError && vectorData && vectorData.length > 0) {
        searchResults = vectorData;
        console.log(`✅ Vector search: ${searchResults.length} results`);
      }
    } catch (embeddingError) {
      console.warn('Vector search failed:', embeddingError);
    }

    // STEP 2: Fallback to text search if vector failed
    if (searchResults.length === 0) {
      console.log('📝 Falling back to text search...');
      
      const { data: textData, error: textError } = await supabase
        .rpc('match_chunks_text', {
          query_text: query,
          top_k: max_results * 2,
          manual: manual_id || null,
          tenant_id: tenantId
        });

      if (!textError && textData && textData.length > 0) {
        searchResults = textData;
        console.log(`✅ Text search: ${searchResults.length} results`);
      }
    }

    // STEP 3: Last resort - simple SQL LIKE search
    if (searchResults.length === 0) {
      console.log('🔍 Last resort: simple SQL search...');
      
      let whereClause = "content ILIKE '%' || $1 || '%'";
      const params = [query];
      
      if (manual_id) {
        whereClause += " AND manual_id = $2";
        params.push(manual_id);
      }
      
      whereClause += ` AND fec_tenant_id = $${params.length + 1}`;
      params.push(tenantId);

      const { data: sqlData, error: sqlError } = await supabase
        .rpc('simple_search', { 
          search_query: query,
          search_manual: manual_id,
          search_tenant: tenantId,
          search_limit: max_results
        });

      if (!sqlError && sqlData && sqlData.length > 0) {
        // Add fake similarity scores for consistency
        searchResults = sqlData.map((item: any) => ({
          ...item,
          score: 0.5, // Fake score for fallback results
          content_type: 'text'
        }));
        console.log(`✅ SQL search: ${searchResults.length} results`);
      }
    }

    // Apply MMR for better diversity
    if (searchResults.length > 3) {
      console.log('🔄 Applying MMR reranking...');
      searchResults = applyMMR(searchResults, 0.7, max_results);
    } else {
      searchResults = searchResults.slice(0, max_results);
    }

    // Enhance with manual titles
    const enhancedResults = [];
    if (searchResults.length > 0) {
      const manualIds = [...new Set(searchResults.map(r => r.manual_id))];
      const { data: manuals } = await supabase
        .from('documents')
        .select('manual_id, title')
        .in('manual_id', manualIds);

      const manualTitleMap = new Map(manuals?.map(m => [m.manual_id, m.title]) || []);

      for (const result of searchResults) {
        enhancedResults.push({
          id: result.id,
          content: result.content,
          manual_id: result.manual_id,
          manual_title: manualTitleMap.get(result.manual_id) || 'Unknown Manual',
          page_start: result.page_start,
          page_end: result.page_end,
          menu_path: result.menu_path,
          similarity: result.score || result.similarity || 0.5,
          content_type: result.content_type || 'text'
        });
      }
    }

    console.log(`✅ Robust search completed: ${enhancedResults.length} final results`);

    return new Response(JSON.stringify({
      query,
      results: enhancedResults,
      total_results: enhancedResults.length,
      search_strategy: searchResults.length > 0 ? 'successful' : 'no_results'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🚨 Robust search failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      results: [], // Always return empty array instead of failing
      total_results: 0
    }), {
      status: 200, // Return 200 even on error so chat doesn't break
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});