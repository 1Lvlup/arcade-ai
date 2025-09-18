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
    const { query, manual_id, max_results = 10 } = await req.json();
    
    if (!query) {
      throw new Error('Query is required');
    }

    console.log(`Searching for: "${query}" in manual: ${manual_id || 'all'}`);

    // Create embedding for the search query
    const queryEmbedding = await createEmbedding(query);

    // Search using the database function
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_manual_content', {
        query_embedding: queryEmbedding,
        search_manual_id: manual_id || null,
        match_count: max_results,
        similarity_threshold: 0.7
      });

    if (searchError) {
      console.error('Search error:', searchError);
      throw searchError;
    }

    console.log(`Found ${searchResults?.length || 0} results`);

    // Enhance results with manual titles
    const enhancedResults = [];
    if (searchResults && searchResults.length > 0) {
      // Get manual titles for context
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
          similarity: result.similarity,
          content_type: result.content_type,
          // Add image URL for figure results
          ...(result.content_type === 'figure' && {
            image_available: true
          })
        });
      }
    }

    return new Response(JSON.stringify({
      query,
      results: enhancedResults,
      total_results: enhancedResults.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-manuals function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});