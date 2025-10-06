import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
const openaiProjectId = Deno.env.get("OPENAI_PROJECT_ID");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get AI config and determine model parameters
async function getModelConfig(tenant_id: string) {
  await supabase.rpc('set_tenant_context', { tenant_id });
  
  const { data: config } = await supabase
    .from('ai_config')
    .select('config_value')
    .eq('config_key', 'chat_model')
    .single();
  
  let model = 'gpt-5-2025-08-07'; // Default
  if (config?.config_value) {
    const value = config.config_value;
    // If it's already a string and looks like a model name, use it directly
    if (typeof value === 'string' && (value.startsWith('gpt-') || value.startsWith('claude-'))) {
      model = value;
    } else if (typeof value === 'string') {
      // Try to parse JSON-stringified values
      try {
        model = JSON.parse(value);
      } catch {
        model = value;
      }
    } else {
      model = value;
    }
  }
  
  const isGpt5 = model.includes('gpt-5');
  
  return {
    model,
    maxTokensParam: isGpt5 ? 'max_completion_tokens' : 'max_tokens',
    supportsTemperature: !isGpt5
  };
}

// Extract technical keywords from query
function keywordLine(q: string): string {
  const toks = q.match(/\b(CR-?2032|CMOS|BIOS|HDMI|VGA|J\d+|pin\s?\d+|[0-9]+V|5V|12V|error\s?E-?\d+)\b/ig) || [];
  return [...new Set(toks)].join(" ");
}

// Token boost for exact technical term matches
function tokenBoost(text: string): number {
  return /\b(CR-?2032|CMOS|BIOS|HDMI|J\d+|pin\s?\d+|[0-9]+V)\b/i.test(text) ? 0.15 : 0;
}

// Maximal Marginal Relevance for result diversity
function applyMMR(results: any[], lambda = 0.7, targetCount = 10): any[] {
  if (results.length <= targetCount) return results;

  const selected = [results[0]];
  const remaining = results.slice(1);

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevanceScore = (candidate.score || 0) + tokenBoost(candidate.content);

      let maxSimilarity = 0;
      for (const sel of selected) {
        const similarity = textSimilarity(candidate.content, sel.content);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      const diversityScore = 1 - maxSimilarity;

      const mmrScore = lambda * relevanceScore + (1 - lambda) * diversityScore;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

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

// Create embedding for search
async function createEmbedding(text: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify({ 
      model: "text-embedding-3-small", 
      input: text 
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Search for relevant chunks using hybrid approach
async function searchChunks(query: string, manual_id?: string, tenant_id?: string) {
  const startTime = Date.now();
  
  const keywords = keywordLine(query);
  const hybridQuery = keywords ? `${query}\nKeywords: ${keywords}` : query;
  
  console.log('🔍 Starting hybrid search for query:', query.substring(0, 100));
  if (keywords) {
    console.log('🔑 Extracted keywords:', keywords);
  }
  
  const queryEmbedding = await createEmbedding(hybridQuery);
  console.log('✅ Created query embedding');

  // Vector search - retrieve top 60 for reranking
  const { data: vectorResults, error: vectorError } = await supabase.rpc('match_chunks_improved', {
    query_embedding: queryEmbedding,
    top_k: 60,
    min_score: 0.30,
    manual: manual_id,
    tenant_id: tenant_id
  });

  if (vectorError) {
    console.error('❌ Vector search error:', vectorError);
  }

  console.log(`📊 Vector search found ${vectorResults?.length || 0} results`);

  const candidates = vectorResults || [];
  const strategy = candidates.length > 0 ? 'vector' : 'none';

  console.log(`✅ Using ${strategy} search strategy with ${candidates.length} candidates`);

  // Apply Cohere Rerank
  let finalResults = [];
  if (candidates.length > 0) {
    try {
      const cohereApiKey = Deno.env.get("COHERE_API_KEY");
      if (!cohereApiKey) {
        console.warn('⚠️ COHERE_API_KEY not found, skipping rerank');
        finalResults = candidates.slice(0, 10);
      } else {
        console.log('🔄 Reranking with Cohere...');
        const truncatedDocs = candidates.map(c => 
          c.content.length > 1500 ? c.content.slice(0, 1500) : c.content
        );
        
        const cohereRes = await fetch("https://api.cohere.ai/v1/rerank", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cohereApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "rerank-english-v3.0",
            query: query,
            documents: truncatedDocs,
            top_n: 10
          })
        });

        if (!cohereRes.ok) {
          const errorText = await cohereRes.text();
          console.error('❌ Cohere rerank failed:', cohereRes.status, errorText);
          finalResults = candidates.slice(0, 10);
        } else {
          const rerank = await cohereRes.json();
          finalResults = rerank.results.map((r: any) => ({
            ...candidates[r.index],
            rerank_score: r.relevance_score,
            original_score: candidates[r.index].score
          }));
          console.log(`✅ Reranked to top ${finalResults.length} results`);
        }
      }
    } catch (error) {
      console.error('❌ Rerank error:', error);
      finalResults = candidates.slice(0, 10);
    }
  }

  const searchTime = Date.now() - startTime;
  console.log(`⏱️ Search completed in ${searchTime}ms`);

  return { results: finalResults, strategy };
}

// ─────────────────────────────────────────────────────────────────────────
// 🎯 SINGLE STAGE: GPT-5 Thinking (Expert Voice)
// ─────────────────────────────────────────────────────────────────────────
async function generateAnswer(
  query: string,
  chunks: any[]
): Promise<string> {
  // Build context from chunks
  const contextBlocks = chunks.map((c, i) => {
    const pageInfo = c.page_start 
      ? (c.page_end && c.page_end !== c.page_start 
          ? `[p${c.page_start}-${c.page_end}]` 
          : `[p${c.page_start}]`)
      : '[page unknown]';
    return `[${i + 1}] ${pageInfo} ${c.content}`;
  }).join('\n\n');

  const systemPrompt = `You are GPT-5 Thinking, the user's pinnacle-level sidekick. You read intent and sentiment, adapt to the user's expertise, and answer like a seasoned field engineer who also sees the business chessboard. You are clever, warm, and decisive—never robotic.

OPERATING PRINCIPLES
- Human first: infer experience level from phrasing and past turns; match depth and pace. Skip 101-level explanations unless explicitly requested.
- Beyond the manual: use provided context/snippets as grounding, but give the high-leverage path (shortcuts, failure modes, common gotchas, decision points). Add practical heuristics and triage logic.
- No verbatim citation dumps or page-callouts. Speak naturally. If precision matters (voltages, DIP positions, part numbers), state the value cleanly and confidently; if uncertain, say "likely" and offer a quick check.
- Minimal questions: only ask when a single answer changes the plan (e.g., board revision or power rail reading). Otherwise proceed with the most probable branch and note alternatives.
- Calm truthfulness: if something isn't in context, say so briefly and state the smallest piece of info you need to continue.
- Style: start with the answer, then why, then the shortest path to resolution. Keep it conversational, focused, and useful.

OUTPUT SHAPE (flexible, not rigid)
- Answer (2–6 sentences): the decisive take.
- Fast Path (numbered): 3–7 steps prioritizing highest success/lowest effort first.
- If-then branches: when a reading or observation forks the path, include one-line "If X → do Y" rules.
- Optional: "Why this works" (1–2 lines) to teach just enough without slowing the user down.
- Keep totals tight; no fluff; no chain-of-thought.`;

  const userPrompt = `User: ${query}

Context (use as grounding, not a script):
${contextBlocks}

Task: Give a decisive, human answer in the style described in the System Prompt. Assume the user knows the basics; don't restate obvious menu navigation unless it is the fix. Prefer the highest-signal checks first. If a single fact would change the plan, ask just that one question; otherwise proceed.

Format: 
- Answer
- Fast Path (numbered)
- If-then branches (optional)
- Why this works (optional)`;

  console.log('🤖 Generating answer with GPT-5 Thinking...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_completion_tokens: 350,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ OpenAI error:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const answerText = data.choices[0].message.content;

  console.log('✅ Answer generated');
  
  return answerText;
}

// ─────────────────────────────────────────────────────────────────────────
// 🚀 SIMPLIFIED RAG PIPELINE (Retrieval + Single GPT-5 Call)
// ─────────────────────────────────────────────────────────────────────────
async function runRagPipelineV3(query: string, manual_id?: string, tenant_id?: string) {
  console.log('\n🚀 [RAG V3] Starting simplified pipeline...\n');
  
  // ──────────────────────────────────────────────────────────────────────
  // STAGE 0: Retrieval + Reranking (Cohere)
  // ──────────────────────────────────────────────────────────────────────
  console.log('🔎 STAGE 0: Hybrid search + reranking...');
  const { results: chunks, strategy } = await searchChunks(query, manual_id, tenant_id);
  console.log(`📊 Retrieved ${chunks.length} chunks after reranking`);

  if (!chunks || chunks.length === 0) {
    console.log('⚠️ No chunks found');
    return {
      answer: "I couldn't find relevant information in the manual for that question. Could you rephrase or provide more context?",
      sources: [],
      strategy: 'none',
      pipeline_version: 'v3'
    };
  }

  // Apply answerability gate
  const maxRerankScore = Math.max(...chunks.map(c => c.rerank_score ?? 0));
  const maxBaseScore = Math.max(...chunks.map(c => c.score ?? 0));
  const hasGoodRerank = maxRerankScore >= 0.45;
  const hasGoodBase = maxBaseScore >= 0.35;
  const weak = (chunks.length < 3) || (!hasGoodRerank && !hasGoodBase);

  console.log(`📊 Answerability check:`, {
    chunk_count: chunks.length,
    max_rerank: maxRerankScore.toFixed(3),
    max_base: maxBaseScore.toFixed(3),
    is_weak: weak
  });

  if (weak) {
    console.log('⚠️ Answerability gate failed');
    return {
      answer: "I don't have enough relevant information in the manual to answer that confidently. Can you rephrase or narrow the question?",
      sources: chunks.slice(0, 3).map((c: any) => ({
        page_start: c.page_start,
        page_end: c.page_end,
        content: c.content.substring(0, 200),
        score: c.score
      })),
      strategy,
      pipeline_version: 'v3',
      gate_reason: 'insufficient_quality'
    };
  }

  // Take top chunks for context
  const topChunks = chunks.slice(0, 10);

  // ──────────────────────────────────────────────────────────────────────
  // STAGE 1: Single GPT-5 Thinking Call
  // ──────────────────────────────────────────────────────────────────────
  console.log('🎯 STAGE 1: Generating answer with GPT-5 Thinking...');
  const answer = await generateAnswer(query, topChunks);

  console.log('✅ [RAG V3] Pipeline complete\n');

  return {
    answer,
    sources: topChunks.map((c: any) => ({
      manual_id: c.manual_id,
      content: c.content.substring(0, 200) + "...",
      page_start: c.page_start,
      page_end: c.page_end,
      menu_path: c.menu_path,
      score: c.score,
      rerank_score: c.rerank_score
    })),
    strategy,
    chunks: topChunks,
    pipeline_version: 'v3'
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, manual_id } = await req.json();
    
    if (!query) {
      throw new Error("Query is required");
    }

    console.log("\n=================================");
    console.log("🔍 NEW CHAT REQUEST");
    console.log("Query:", query);
    console.log("Manual ID:", manual_id || "All manuals");
    console.log("=================================\n");

    // Extract tenant from auth header
    const authHeader = req.headers.get('authorization');
    let tenant_id: string | undefined;
    
    if (authHeader) {
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(jwt);
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('fec_tenant_id')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          tenant_id = profile.fec_tenant_id;
          await supabase.rpc('set_tenant_context', { tenant_id });
          console.log('👤 Tenant ID:', tenant_id);
        }
      }
    }

    // Run V3 Pipeline (simplified single-stage)
    console.log('🚀 Using RAG Pipeline V3 (Single-Stage)\n');
    
    const result = await runRagPipelineV3(query, manual_id, tenant_id);
    
    const { answer, sources, strategy, chunks } = result;

    // Build metadata
    const metadata = {
      pipeline_version: 'v3',
      manual_id: manual_id || "all_manuals",
      embedding_model: "text-embedding-3-small",
      retrieval_strategy: strategy,
      candidate_count: chunks?.length || 0,
      rerank_scores: chunks?.slice(0, 10).map(c => c.rerank_score ?? null) || [],
    };

    const contextSeen = chunks?.map(chunk => {
      const pageInfo = chunk.page_start 
        ? `[Pages ${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}]`
        : '';
      const pathInfo = chunk.menu_path ? `[${chunk.menu_path}]` : '';
      return `${pageInfo}${pathInfo ? ' ' + pathInfo : ''}\n${chunk.content}`;
    }).join('\n\n---\n\n') || '';

    return new Response(JSON.stringify({ 
      answer,
      sources,
      strategy,
      metadata,
      context_seen: contextSeen
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ CHAT ERROR:", error);
    console.error("Stack:", error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      sources: [],
      strategy: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
