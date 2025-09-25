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

// Search thresholds
const VECTOR_THRESHOLD = 0.7
const TEXT_THRESHOLD = 0.1
const DEFAULT_MAX_RESULTS = 6

// Query expansion for arcade game terminology
function expandQuery(query: string): string {
  const synonyms = {
    'not working': 'broken, fails, error, malfunction, issue',
    'stuck': 'jammed, frozen, stuck, blocked, immobile',
    'coin': 'credit, token, quarter, payment, money',
    'joystick': 'controller, stick, control, directional',
    'button': 'switch, control, input, press',
    'screen': 'monitor, display, CRT, video',
    'sound': 'audio, speaker, noise, volume',
    'power': 'electrical, voltage, supply, AC/DC',
    'cabinet': 'arcade, machine, unit, housing'
  }
  
  let expandedQuery = query.toLowerCase()
  for (const [term, expansion] of Object.entries(synonyms)) {
    if (expandedQuery.includes(term)) {
      expandedQuery += ` ${expansion}`
    }
  }
  
  return expandedQuery
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

// Generate hypothetical answer for HyDE
async function generateHypotheticalAnswer(query: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert arcade game technician. Generate a detailed technical answer to troubleshoot the given issue. Focus on specific components, procedures, and solutions.'
        },
        {
          role: 'user',
          content: `Generate a technical troubleshooting answer for: ${query}`
        }
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI chat API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Rerank results for better precision
async function rerankResults(query: string, results: any[]): Promise<any[]> {
  if (results.length <= 3) return results

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a search ranking expert. Rank the following search results by relevance to the query. Return only the indices (0-based) in order of relevance, comma-separated.'
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nResults:\n${results.map((r, i) => `${i}: ${r.content.substring(0, 200)}...`).join('\n\n')}\n\nReturn indices in order of relevance:`
        }
      ],
      max_tokens: 50,
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    console.warn('Reranking failed, returning original order')
    return results
  }

  const data = await response.json()
  const indices = data.choices[0].message.content
    .split(',')
    .map((i: string) => parseInt(i.trim()))
    .filter((i: number) => !isNaN(i) && i >= 0 && i < results.length)

  if (indices.length === 0) return results

  return indices.map((i: number) => results[i])
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const { query, manual_id, max_results = DEFAULT_MAX_RESULTS } = await req.json()
    console.log('Search request:', { query, manual_id, max_results })

    // Extract tenant from auth header
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      const jwt = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(jwt)
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('fec_tenant_id')
          .eq('user_id', user.id)
          .single()

        if (profile) {
          await supabase.rpc('set_tenant_context', { tenant_id: profile.fec_tenant_id })
        }
      }
    }

    // Expand query with synonyms
    const expandedQuery = expandQuery(query)
    console.log('Expanded query:', expandedQuery)

    // Generate hypothetical answer and embedding
    const hypotheticalAnswer = await generateHypotheticalAnswer(query)
    const hydeEmbedding = await createEmbedding(hypotheticalAnswer)
    
    console.log('Generated HyDE answer:', hypotheticalAnswer.substring(0, 100) + '...')

    // Primary text search
    const { data: textResults, error: textError } = await supabase
      .rpc('match_chunks_text', {
        query_text: expandedQuery,
        top_k: max_results * 2,
        manual: manual_id
      })

    if (textError) {
      console.error('Text search error:', textError)
    }

    console.log(`Text search found ${textResults?.length || 0} results`)

    // Vector search with progressive thresholds
    let vectorResults = []
    const thresholds = [0.8, 0.75, 0.7, 0.65, 0.6]
    
    for (const threshold of thresholds) {
      const { data: results, error: vectorError } = await supabase
        .rpc('match_chunks_improved', {
          query_embedding: hydeEmbedding,
          top_k: max_results * 2,
          min_score: threshold,
          manual: manual_id
        })

      if (vectorError) {
        console.error('Vector search error:', vectorError)
        continue
      }

      if (results && results.length >= 3) {
        vectorResults = results
        console.log(`Vector search found ${results.length} results at threshold ${threshold}`)
        break
      }
    }

    // Choose best search strategy
    let finalResults = []
    
    if (vectorResults.length >= 3) {
      finalResults = vectorResults.slice(0, max_results)
      console.log('Using vector search results')
    } else if (textResults && textResults.length > 0) {
      finalResults = textResults.slice(0, max_results)
      console.log('Using text search results')
    } else {
      console.log('No results found')
    }

    // Rerank results for better precision
    if (finalResults.length > 3) {
      finalResults = await rerankResults(query, finalResults)
      console.log('Results reranked')
    }

    // Enhance results with manual titles
    const manualIds = [...new Set(finalResults.map(r => r.manual_id))]
    const { data: manuals } = await supabase
      .from('documents')
      .select('manual_id, title')
      .in('manual_id', manualIds)

    const manualTitles = manuals?.reduce((acc, m) => {
      acc[m.manual_id] = m.title
      return acc
    }, {}) || {}

    const enhancedResults = finalResults.map(result => ({
      ...result,
      manual_title: manualTitles[result.manual_id] || result.manual_id
    }))

    console.log(`Returning ${enhancedResults.length} enhanced results`)

    return new Response(JSON.stringify({
      results: enhancedResults,
      total: enhancedResults.length,
      query: expandedQuery,
      strategy: vectorResults.length >= 3 ? 'vector' : 'text'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in search-manuals:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      results: [],
      total: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})