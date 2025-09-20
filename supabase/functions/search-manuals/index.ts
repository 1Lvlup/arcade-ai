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
    const { query, manual_id, max_results = 10 } = requestBody;
    
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
            // Set tenant context for this session
            console.log('🏢 [SEARCH] Setting tenant context...');
            await supabase.rpc('set_tenant_context', {
              tenant_id: profile.fec_tenant_id
            });
            console.log(`✅ [SEARCH] Set tenant context: ${profile.fec_tenant_id}`);
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

    // Create embedding for the search query
    console.log('🧠 [SEARCH] Creating embedding for query...');
    const queryEmbedding = await createEmbedding(query);
    console.log('✅ [SEARCH] Embedding created, length:', queryEmbedding.length);

    // Search using the database function with fallback logic
    let searchResults = null;
    let searchError = null;
    
    // Try with standard threshold first (0.3)
    let searchParams = {
      query_embedding: queryEmbedding,
      search_manual_id: manual_id || null,
      match_count: max_results,
      similarity_threshold: 0.3
    };

    console.log('🗄️ [SEARCH] Executing database search with params:', {
      ...searchParams,
      query_embedding: `[${queryEmbedding.length} dimensions]`
    });

    let { data: results, error } = await supabase
      .rpc('search_manual_content', searchParams);

    if (error) {
      console.error('❌ [SEARCH] Database search error:', error);
      throw error;
    }

    // If no results found with 0.3 threshold, try with lower threshold (0.1)
    if (!results || results.length === 0) {
      console.log('⚠️ [SEARCH] No results with 0.3 threshold, trying 0.1...');
      searchParams.similarity_threshold = 0.1;
      
      const { data: fallbackResults, error: fallbackError } = await supabase
        .rpc('search_manual_content', searchParams);
        
      if (fallbackError) {
        console.error('❌ [SEARCH] Fallback search error:', fallbackError);
        throw fallbackError;
      }
      
      results = fallbackResults;
      console.log(`📊 [SEARCH] Fallback search completed - Found ${results?.length || 0} results`);
    }

    searchResults = results;
    searchError = error;

    console.log(`📊 [SEARCH] Database search completed - Found ${searchResults?.length || 0} results`);

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
          similarity: result.similarity,
          content_type: result.content_type,
          // Add image URL for figure results
          ...(result.content_type === 'figure' && {
            image_available: true
          })
        });
      }
    }

    console.log('✅ [SEARCH] Search completed successfully:', {
      resultsCount: enhancedResults.length,
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