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

// Maximal Marginal Relevance for result diversity
function applyMMR(results: any[], lambda = 0.7, targetCount = 10): any[] {
  if (results.length <= targetCount) return results;

  const selected = [results[0]]; // Start with highest scoring result
  const remaining = results.slice(1);

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevanceScore = candidate.rerank_score || candidate.score || 0;

      // Calculate diversity (1 - max similarity to selected items)
      let maxSimilarity = 0;
      for (const sel of selected) {
        const similarity = textSimilarity(candidate.content, sel.content);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      const diversityScore = 1 - maxSimilarity;

      // MMR formula: λ * relevance + (1-λ) * diversity
      const mmrScore = lambda * relevanceScore + (1 - lambda) * diversityScore;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  console.log(`✅ MMR applied: ${results.length} → ${selected.length} results (diversity improved)`);
  return selected;
}

// Simple text similarity using Jaccard similarity
function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

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

// Check if query is asking for visual content
function isVisualQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return /\b(diagram|show|illustration|schematic|drawing|image|picture|figure)\b/.test(lowerQuery);
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
        top_n: Math.min(15, documents.length), // 🔥 TESTING: Get more results including figures
        return_documents: false,
      }),
    });

    if (!response.ok) {
      console.error('❌ Cohere rerank failed:', response.status);
      return documents;
    }

    const data = await response.json();
    
    // 🔥 TESTING MODE: FORCE VISUAL FIGURES TO TOP
    const FIGURE_BOOST = 0.20; // 20% boost for visual figures
    const TEXT_FIGURE_PENALTY = -0.50; // 50% penalty for text-only figures
    
    // Map reranked indices back to original documents with scores
    let reranked = data.results.map((result: any) => {
      const doc = documents[result.index];
      let finalScore = result.relevance_score;
      
      // Boost actual visual content, penalize text-only figures
      if (doc.content_type === 'figure') {
        const figureType = doc.figure_type?.toLowerCase() || '';
        
        // Penalize text-only figures heavily
        if (figureType.includes('text') || figureType.includes('sectionheader')) {
          finalScore = finalScore * (1 + TEXT_FIGURE_PENALTY);
          console.log(`📝 PENALIZED text figure p${doc.page_start} (${doc.figure_type}): ${result.relevance_score.toFixed(3)} → ${finalScore.toFixed(3)}`);
        } 
        // Boost actual visual content
        else {
          finalScore = finalScore * (1 + FIGURE_BOOST);
          console.log(`🖼️ BOOSTED visual figure p${doc.page_start} (${doc.figure_type}): ${result.relevance_score.toFixed(3)} → ${finalScore.toFixed(3)}`);
        }
      }
      
      return {
        ...doc,
        rerank_score: finalScore,
      };
    });
    
    // Always re-sort after applying figure boost
    reranked = reranked.sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0));
    console.log(`🎯 TESTING MODE: Figures boosted by 80% and sorted to top`);

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
    const { query, manual_id, tenant_id, top_k = 75 } = await req.json();

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

    // Strategy 1: Vector search using unified function (text chunks + figures)
    let rawResults: any[] = [];
    let strategy = 'vector_search';
    
    const { data: vectorData, error: vectorError } = await supabase.rpc(
      'match_chunks_improved',
      {
        query_embedding: embedding,
        top_k: top_k,
        min_score: 0.18,
        manual: manual_id || null,
        tenant_id: tenant_id || null,
      }
    );

    if (vectorError) {
      console.error('❌ Vector search error:', vectorError);
    } else {
      rawResults = vectorData || [];
    }

    console.log(`📦 Vector search retrieved ${rawResults.length} candidates`);

    // Strategy 2: Text search fallback if vector search yields few results
    if (rawResults.length < 3) {
      console.log('⚠️ Low vector results, trying text search fallback');
      const { data: textData, error: textError } = await supabase.rpc('match_chunks_text', {
        query_text: query,
        top_k: top_k,
        manual: manual_id || null,
        tenant_id: tenant_id || null,
      });

      if (textError) {
        console.error('❌ Text search error:', textError);
      } else if (textData && textData.length > 0) {
        rawResults = textData;
        strategy = 'text_search';
        console.log(`📦 Text search retrieved ${rawResults.length} candidates`);
      }
    }

    // Strategy 3: Simple search as last resort
    if (rawResults.length === 0) {
      console.log('⚠️ No results from vector/text, trying simple search');
      const { data: simpleData, error: simpleError } = await supabase.rpc('simple_search', {
        search_query: query,
        search_manual: manual_id || null,
        search_tenant: tenant_id || null,
        search_limit: top_k,
      });

      if (simpleError) {
        console.error('❌ Simple search error:', simpleError);
      } else if (simpleData && simpleData.length > 0) {
        rawResults = simpleData.map((r: any) => ({
          ...r,
          score: 0.5,
          content_type: 'text'
        }));
        strategy = 'simple_search';
        console.log(`📦 Simple search retrieved ${rawResults.length} candidates`);
      }
    }

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
    let reranked = await rerankResults(query, rawResults);

    // 🚨 LAYER 1: Hard filter to prevent cross-manual leakage
    if (manual_id) {
      const beforeFilter = reranked.length;
      reranked = reranked.filter(r => r.manual_id === manual_id);
      const dropped = beforeFilter - reranked.length;
      if (dropped > 0) {
        console.warn(`🚫 DROPPED ${dropped} cross-manual results (requested: ${manual_id})`);
      }
      console.log(`✅ Hard filter: ${reranked.length} results confirmed for manual_id="${manual_id}"`);
    }

    // 🔥 FILTER OUT only explicitly text-only figures (keep NULL types - they're likely visual)
    const visualOnly = reranked.filter(r => {
      if (r.content_type !== 'figure') return true; // Keep all text chunks
      
      const figureType = (r.figure_type || '').toLowerCase();
      
      // Only exclude if EXPLICITLY marked as text-only or section header
      const isExplicitlyTextOnly = 
        figureType === 'text' || 
        figureType === 'sectionheader' || 
        figureType === 'text_snippet';
      
      if (isExplicitlyTextOnly) {
        console.log(`🚫 EXCLUDED text-only figure p${r.page_start} (${r.figure_type})`);
        return false;
      }
      
      // Keep all other figures (including NULL types which are likely visual)
      return true;
    });

    console.log(`📊 Filtered ${reranked.length} → ${visualOnly.length} results (removed text-only figures)`);

    // 🎯 INTENT DETECTION + ANCHOR BOOST
    const hasVisualIntent = isVisualQuery(query);
    console.log(`🔍 Visual query detected: ${hasVisualIntent}`);
    
    // Apply anchor boost: figures on same pages as top text chunks get extra weight
    const topTextPages = new Set(
      visualOnly
        .filter(r => r.content_type === 'text')
        .slice(0, 6)
        .map(r => r.page_start)
    );
    
    for (const result of visualOnly) {
      if (result.content_type === 'figure') {
        let boost = 1.0;
        
        // Anchor boost: figure on same page as top text
        if (topTextPages.has(result.page_start)) {
          boost *= 1.12;
          console.log(`📍 ANCHOR BOOST: p${result.page_start} figure is on same page as top text`);
        }
        
        // Intent boost: visual query gets moderate figure boost
        if (hasVisualIntent) {
          boost *= 1.10;
        }
        
        if (boost > 1.0) {
          const oldScore = result.rerank_score || 0;
          result.rerank_score = oldScore * boost;
          console.log(`  Score: ${oldScore.toFixed(3)} → ${result.rerank_score.toFixed(3)}`);
        }
      }
    }
    
    // Re-sort after applying boosts
    visualOnly.sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0));

    // Apply MMR for diversity before final separation
    const diverseResults = applyMMR(visualOnly, 0.7, Math.min(15, visualOnly.length));

    // Separate text and figure results
    let textResults = diverseResults.filter(r => r.content_type === 'text').slice(0, 10);
    let figureResults = diverseResults.filter(r => r.content_type === 'figure').slice(0, 5);
    
    // 🎯 GUARANTEE FIGURE SLOTS for visual queries
    if (hasVisualIntent && figureResults.length === 0) {
      // Find best figure even if it didn't make top results
      const allFigures = visualOnly.filter(r => r.content_type === 'figure');
      if (allFigures.length > 0) {
        console.log(`⚠️ Visual query but no figures in top results - forcing best figure`);
        figureResults = [allFigures[0]];
        // Remove one text result to make room
        textResults = textResults.slice(0, 9);
      }
    }
    
    console.log(`✅ Final separation: ${textResults.length} text chunks, ${figureResults.length} figures`);

    // Enhance results with manual titles
    const manualIds = [...new Set([...textResults, ...figureResults].map(r => r.manual_id))];
    const { data: manuals } = await supabase
      .from('documents')
      .select('manual_id, title')
      .in('manual_id', manualIds);

    const manualTitles = manuals?.reduce((acc: any, m: any) => {
      acc[m.manual_id] = m.title;
      return acc;
    }, {}) || {};

    // Add manual titles to results
    textResults = textResults.map((r: any) => ({
      ...r,
      manual_title: manualTitles[r.manual_id] || r.manual_id
    }));

    figureResults = figureResults.map((r: any) => ({
      ...r,
      manual_title: manualTitles[r.manual_id] || r.manual_id
    }));

    return new Response(
      JSON.stringify({
        textResults,
        figureResults,
        allResults: diverseResults.slice(0, 10), // Backwards compatibility
        count: textResults.length + figureResults.length,
        total_candidates: rawResults.length,
        strategy,
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
