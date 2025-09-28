import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

// Maximal Marginal Relevance for result diversity
function applyMMR(results: any[], lambda = 0.7, targetCount = 6): any[] {
  if (results.length <= targetCount) return results

  const selected = [results[0]] // Start with highest scoring result
  const remaining = results.slice(1)

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = 0
    let bestScore = -1

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]
      const relevanceScore = candidate.score || 0

      // Calculate diversity (1 - max similarity to selected items)
      let maxSimilarity = 0
      for (const sel of selected) {
        const similarity = textSimilarity(candidate.content, sel.content)
        maxSimilarity = Math.max(maxSimilarity, similarity)
      }
      const diversityScore = 1 - maxSimilarity

      // MMR formula: λ * relevance + (1-λ) * diversity
      const mmrScore = lambda * relevanceScore + (1 - lambda) * diversityScore

      if (mmrScore > bestScore) {
        bestScore = mmrScore
        bestIdx = i
      }
    }

    selected.push(remaining[bestIdx])
    remaining.splice(bestIdx, 1)
  }

  return selected
}

// Simple text similarity using Jaccard similarity
function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/))
  const words2 = new Set(text2.toLowerCase().split(/\s+/))
  
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

// Create embedding using OpenAI
async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const { query, manual_id, max_results = 6 } = await req.json()
    console.log('Robust search request:', { query, manual_id, max_results })

    // Extract tenant from auth header
    let tenantId = null
    const authHeader = req.headers.get('authorization')
    
    if (authHeader) {
      try {
        const apiKey = authHeader.replace('Bearer ', '')
        
        // Try JWT first
        const { data: { user } } = await supabase.auth.getUser(apiKey)
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('fec_tenant_id')
            .eq('user_id', user.id)
            .single()

          if (profile) {
            tenantId = profile.fec_tenant_id
            await supabase.rpc('set_tenant_context', { tenant_id: tenantId })
          }
        }
      } catch (jwtError) {
        console.log('JWT auth failed, trying API key auth')
        // Could implement API key auth here if needed
      }
    }

    console.log('Using tenant:', tenantId)

    // Create embedding for the query
    const queryEmbedding = await createEmbedding(query)
    console.log('Created query embedding')

    // Strategy 1: Vector search
    const { data: vectorResults, error: vectorError } = await supabase
      .rpc('match_chunks_improved', {
        query_embedding: queryEmbedding,
        top_k: max_results * 2,
        min_score: 0.3,
        manual: manual_id,
        tenant_id: tenantId
      })

    if (vectorError) {
      console.error('Vector search error:', vectorError)
    }

    console.log(`Vector search found ${vectorResults?.length || 0} results`)

    // Strategy 2: Text search fallback
    let textResults = []
    if (!vectorResults || vectorResults.length < 3) {
      const { data: textData, error: textError } = await supabase
        .rpc('match_chunks_text', {
          query_text: query,
          top_k: max_results * 2,
          manual: manual_id,
          tenant_id: tenantId
        })

      if (textError) {
        console.error('Text search error:', textError)
      } else {
        textResults = textData || []
        console.log(`Text search found ${textResults.length} results`)
      }
    }

    // Strategy 3: Simple search as last resort
    let simpleResults = []
    if ((!vectorResults || vectorResults.length === 0) && textResults.length === 0) {
      const { data: simpleData, error: simpleError } = await supabase
        .rpc('simple_search', {
          search_query: query,
          search_manual: manual_id,
          search_tenant: tenantId,
          search_limit: max_results
        })

      if (simpleError) {
        console.error('Simple search error:', simpleError)
      } else {
        simpleResults = (simpleData || []).map((r: any) => ({
          ...r,
          score: 0.5, // Default score for simple search
          content_type: 'text'
        }))
        console.log(`Simple search found ${simpleResults.length} results`)
      }
    }

    // Choose best results
    let finalResults = []
    if (vectorResults && vectorResults.length > 0) {
      finalResults = vectorResults
      console.log('Using vector search results')
    } else if (textResults.length > 0) {
      finalResults = textResults
      console.log('Using text search results')
    } else {
      finalResults = simpleResults
      console.log('Using simple search results')
    }

    // Apply MMR for diversity if we have enough results
    if (finalResults.length > max_results) {
      finalResults = applyMMR(finalResults, 0.7, max_results)
      console.log('Applied MMR for result diversity')
    } else {
      finalResults = finalResults.slice(0, max_results)
    }

    // Enhance results with manual titles
    const manualIds = [...new Set(finalResults.map((r: any) => r.manual_id))]
    const { data: manuals } = await supabase
      .from('documents')
      .select('manual_id, title')
      .in('manual_id', manualIds)

    const manualTitles = manuals?.reduce((acc: any, m: any) => {
      acc[m.manual_id] = m.title
      return acc
    }, {}) || {}

    const enhancedResults = finalResults.map((result: any) => ({
      ...result,
      manual_title: manualTitles[result.manual_id] || result.manual_id
    }))

    console.log(`Returning ${enhancedResults.length} enhanced results`)

    return new Response(JSON.stringify({
      results: enhancedResults,
      total: enhancedResults.length,
      query,
      strategy: vectorResults?.length > 0 ? 'vector' : textResults.length > 0 ? 'text' : 'simple'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in search-manuals-robust:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      results: [],
      total: 0
    }), {
      status: 200, // Return 200 with error message for better error handling
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})