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

// Environment variable logging
console.log("🔑 Environment variables check:");
console.log(`SUPABASE_URL: ${supabaseUrl ? "✅ Present" : "❌ Missing"}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? "✅ Present" : "❌ Missing"}`);
console.log(`OPENAI_API_KEY: ${openaiApiKey ? "✅ Present" : "❌ Missing"}`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Progressive search thresholds for fallback
const SEARCH_THRESHOLDS = [0.5, 0.35, 0.25];
const DEFAULT_TOP_K = 12;

// Query expansion for better matching
function expandQuery(query: string) {
  const q = query.toLowerCase();
  const synonyms: string[] = [];
  
  // Ice ball / skeeball synonyms
  if (q.includes("ice ball") || q.includes("iceball") || q.includes("skeeball") || q.includes("ski ball")) {
    synonyms.push('iceball', 'skeeball', 'ski-ball', 'ball game');
  }
  
  // Ball feeding/dispensing issues
  if (q.includes("ball") && (q.includes("stuck") || q.includes("not coming") || q.includes("feed") || q.includes("return") || q.includes("dispense"))) {
    synonyms.push('ball return', 'ball feed', 'ball release', 'ball eject', 'feeder', 'dispenser', 'ball mechanism');
  }
  
  // Game starting issues
  if (q.includes("game") && (q.includes("start") || q.includes("begin") || q.includes("launch"))) {
    synonyms.push('game start', 'game begin', 'initialization', 'startup');
  }
  
  return { original: query, synonyms, expanded: [query, ...synonyms].join(' ') };
}

// Create embeddings using OpenAI
async function createEmbedding(text: string): Promise<number[]> {
  const input = text.length > 8000 ? text.slice(0, 8000) : text;
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { query, manual_id, max_results = 5 } = requestBody;
    
    console.log('🔍 [SEARCH] Function invoked:', {
      query: query?.slice(0, 100) + (query?.length > 100 ? '...' : ''),
      manual_id,
      max_results,
      timestamp: new Date().toISOString()
    });
    
    if (!query) {
      console.error('❌ [SEARCH] Query is required');
      throw new Error('Query is required');
    }

    console.log(`🔍 [SEARCH] Searching for: "${query}" in manual: ${manual_id || 'all'}`);

    // Extract tenant context from authorization header for tenant isolation
    const authHeader = req.headers.get('authorization');
    console.log('🔐 [SEARCH] Checking authorization header:', !!authHeader);
    
    let tenantId = null;
    if (authHeader) {
      try {
        console.log('🔐 [SEARCH] Extracting user from token...');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          console.log('✅ [SEARCH] User authenticated:', { userId: user.id });
          
          // Get user's tenant ID from profiles
          console.log('🏢 [SEARCH] Fetching user profile for tenant context...');
          const { data: profile } = await supabase
            .from('profiles')
            .select('fec_tenant_id')
            .eq('user_id', user.id)
            .single();
            
          console.log('👤 [SEARCH] Profile data:', { profile: !!profile, tenant_id: profile?.fec_tenant_id });
            
          if (profile?.fec_tenant_id) {
            tenantId = profile.fec_tenant_id;
            console.log(`✅ [SEARCH] Set tenant context: ${tenantId}`);
          } else {
            console.log('⚠️ [SEARCH] No tenant ID found in profile');
          }
        } else {
          console.log('❌ [SEARCH] No user found from token');
        }
      } catch (authError) {
        console.error('❌ [SEARCH] Error setting tenant context:', authError);
      }
    } else {
      console.log('⚠️ [SEARCH] No authorization header provided');
    }

    // Expand query for better matching
    const { original, synonyms, expanded } = expandQuery(query);
    console.log('🧠 [SEARCH] Query expansion:', { original, synonyms });

    // Create embedding for the search query
    console.log('🧠 [SEARCH] Creating embedding for query...');
    const queryEmbedding = await createEmbedding(query);
    console.log('✅ [SEARCH] Embedding created, length:', queryEmbedding.length);

    // Progressive vector search with fallback thresholds
    let vectorResults: any[] = [];
    let usedThreshold = null;

    for (const threshold of SEARCH_THRESHOLDS) {
      console.log(`🗄️ [SEARCH] Trying vector search with threshold: ${threshold}`);
      
      const { data, error } = await supabase
        .rpc('match_chunks_improved', {
          query_embedding: queryEmbedding,
          top_k: max_results * 2, // Get more results to filter
          min_score: threshold,
          manual: manual_id || null,
          tenant_id: tenantId
        });

      if (error) {
        console.error('❌ [SEARCH] Vector search error:', error);
        break;
      }

      if (data && data.length > 0) {
        vectorResults = data.slice(0, max_results); // Trim to requested count
        usedThreshold = threshold;
        console.log(`✅ [SEARCH] Vector hits at threshold ${threshold}:`, 
          vectorResults.slice(0, 3).map(d => ({ id: d.id, score: d.score })));
        break;
      } else {
        console.log(`…no hits at threshold ${threshold}`);
      }
    }

    // Hybrid fallback: text search if vector returned nothing
    let hybridResults: any[] = [];
    if (vectorResults.length === 0) {
      console.log('📝 [SEARCH] Vector search failed, trying text search fallback...');
      
      const { data: textData, error: textError } = await supabase
        .rpc('match_chunks_text', {
          query_text: expanded,
          top_k: max_results,
          manual: manual_id || null,
          tenant_id: tenantId
        });

      if (textError) {
        console.error('❌ [SEARCH] Text search error:', textError);
      } else if (textData && textData.length > 0) {
        hybridResults = textData;
        console.log('📝 [SEARCH] Text search hits:', 
          hybridResults.slice(0, 3).map(d => ({ id: d.id, score: d.score })));
      }
    }

    // Use vector results if available, otherwise use text results
    const searchResults = vectorResults.length > 0 ? vectorResults : hybridResults;
    const searchStrategy = vectorResults.length > 0 ? 'vector' : 'text';

    console.log(`📊 [SEARCH] Search completed - Found ${searchResults?.length || 0} results using ${searchStrategy} strategy`);

    // Enhance results with manual titles
    console.log('📚 [SEARCH] Enhancing results with manual titles...');
    const enhancedResults = [];
    if (searchResults && searchResults.length > 0) {
      // Get manual titles for context
      const manualIds = [...new Set(searchResults.map(r => r.manual_id))];
      console.log('📚 [SEARCH] Fetching manual titles for IDs:', manualIds);
      
      const { data: manuals } = await supabase
        .from('documents')
        .select('manual_id, title')
        .in('manual_id', manualIds);

      console.log('📚 [SEARCH] Manual titles fetched:', manuals?.length || 0);
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
          similarity: result.score, // Note: using 'score' from new functions
          content_type: result.content_type
        });
      }
    }

    console.log('✅ [SEARCH] Search completed successfully:', {
      resultsCount: enhancedResults.length,
      searchStrategy,
      usedThreshold,
      manualTitles: [...new Set(enhancedResults.map(r => r.manual_title))],
      avgSimilarity: enhancedResults.length > 0 
        ? enhancedResults.reduce((sum, r) => sum + r.similarity, 0) / enhancedResults.length 
        : 0,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      query,
      results: enhancedResults,
      total_results: enhancedResults.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🚨 [SEARCH] Function failed completely:', {
      error: error.message,
      errorType: error.constructor.name,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});