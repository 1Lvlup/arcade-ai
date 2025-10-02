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

  const selected = [results[0]]; // Start with highest scoring result
  const remaining = results.slice(1);

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevanceScore = (candidate.score || 0) + tokenBoost(candidate.content);

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
  
  // Extract keywords and enhance query
  const keywords = keywordLine(query);
  const hybridQuery = keywords ? `${query}\nKeywords: ${keywords}` : query;
  
  console.log('🔍 Starting hybrid search for query:', query.substring(0, 100));
  if (keywords) {
    console.log('🔑 Extracted keywords:', keywords);
  }
  
  const queryEmbedding = await createEmbedding(hybridQuery);
  console.log('✅ Created query embedding');

  // Strategy 1: Vector search - retrieve top 60 for reranking
  // Tuning: top_k_raw = 60, will rerank to top 10
  // Min score gate: 0.30 (tunable to 0.30-0.35 based on telemetry)
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

  // Use vector results as candidates for reranking
  const candidates = vectorResults || [];
  const strategy = candidates.length > 0 ? 'vector' : 'none';

  console.log(`✅ Using ${strategy} search strategy with ${candidates.length} candidates`);

  // Apply Cohere Rerank if we have candidates
  let finalResults = [];
  if (candidates.length > 0) {
    try {
      const cohereApiKey = Deno.env.get("COHERE_API_KEY");
      if (!cohereApiKey) {
        console.warn('⚠️ COHERE_API_KEY not found, skipping rerank');
        finalResults = candidates.slice(0, 10);
      } else {
        console.log('🔄 Reranking with Cohere...');
        // Truncate documents to ~1500 chars to stay within API limits
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

// STAGE 1: Generate draft answer using ONLY manual context
async function generateDraftAnswer(query: string, chunks: any[]) {
  // Format context with [pX] prefixes for easy citation
  const context = chunks.map((chunk: any, idx: number) => {
    const pagePrefix = chunk.page_start 
      ? `[p${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}]`
      : '[p?]';
    const menuPath = chunk.menu_path ? ` ${chunk.menu_path}` : '';
    
    return `${pagePrefix}${menuPath}\n${chunk.content}`;
  }).join('\n\n---\n\n');

  console.log('📝 [STAGE 1] Formatted context with', chunks.length, 'chunks');
  console.log('📄 Context preview:', context.substring(0, 200) + '...');

  const messages = [
    {
      role: "system",
      content: `You are a senior arcade technician. Using ONLY the provided manual content below,
create a structured draft answer. Include citations (page numbers/figures) where you use information.
If the answer is not in the manual, say so clearly in the draft.
Do not guess or add information beyond the manual in this stage.

CRITICAL RULES:
- NO generic fallbacks like "check cables" or "call a technician"
- Safety warnings ONLY if they appear in the manual context
- If manual doesn't cover it, leave fields empty or state "not in manual"
- Do not invent safety boilerplate

MANUAL CONTEXT:
${context}`
    },
    {
      role: "user",
      content: `Question: ${query}
Provide a draft answer in structured JSON with fields:
{
  "summary": string,
  "steps": [ { "step": string, "expected": string } ],
  "why": [string],
  "safety": [string],
  "sources": [ { "page": number, "note": string } ]
}`
    }
  ];

  const modelConfig = await getModelConfig(tenant_id || '00000000-0000-0000-0000-000000000001');
  
  const requestBody: any = {
    model: modelConfig.model,
    response_format: { type: "json_object" },
    [modelConfig.maxTokensParam]: 900,
    messages
  };
  
  if (modelConfig.supportsTemperature) {
    requestBody.temperature = 0.2;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [STAGE 1] Draft generation failed:', response.status, errorText);
    throw new Error(`Draft generation failed: ${response.status}`);
  }
  
  const data = await response.json();
  const draftJson = JSON.parse(data.choices[0].message.content);
  
  console.log('✅ [STAGE 1] Draft answer generated:', JSON.stringify(draftJson).substring(0, 200) + '...');
  
  return draftJson;
}

// STAGE 2: Enhance draft with expert knowledge
async function generateExpertAnswer(query: string, draftJson: any) {
  console.log('🎓 [STAGE 2] Enhancing draft with expert knowledge...');

  const messages = [
    {
      role: "system",
      content: `You are a master arcade technician mentor. You have:
- The user's question
- A structured draft answer from the manual
- Your own expert knowledge of similar machines and common failures

Tasks:
1) Review the draft for accuracy against the manual.
2) If the manual contains enough info, polish it into a clear, conversational answer.
3) If the manual lacks detail, add your own expert reasoning and best-practice troubleshooting steps beyond the manual (clearly labeled as "Expert Advice").
4) Do not hallucinate specifics about this exact model if unsupported; give generalized best practices or non-destructive tests a pro would run.
5) Always cite the manual where applicable, and clearly separate "manual" vs "expert advice."
6) Make the answer concise, supportive, and actionable.

FORBIDDEN FALLBACKS:
- NO generic "check cables / call a technician" templates
- NO safety boilerplate disconnected from manual or actual diagnostic context
- The ONLY allowed fallback is explicit expert advice for non-destructive diagnostic tests when manual is silent

Return STRICT JSON:
{
  "summary": string,
  "steps": [ { "step": string, "expected": string, "source": "manual"|"expert" } ],
  "expert_advice": [string],
  "safety": [string],
  "sources": [ { "page": number, "note": string } ]
}`
    },
    {
      role: "user",
      content: `Question: ${query}
Manual-based draft answer:
${JSON.stringify(draftJson, null, 2)}`
    }
  ];

  const modelConfig = await getModelConfig(tenant_id || '00000000-0000-0000-0000-000000000001');
  
  const requestBody: any = {
    model: modelConfig.model,
    response_format: { type: "json_object" },
    [modelConfig.maxTokensParam]: 1200,
    messages
  };
  
  if (modelConfig.supportsTemperature) {
    requestBody.temperature = 0.2;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [STAGE 2] Expert enhancement failed:', response.status, errorText);
    console.log('⚠️ Falling back to draft answer');
    return draftJson; // Fallback to draft if enhancement fails
  }
  
  const data = await response.json();
  const expertJson = JSON.parse(data.choices[0].message.content);
  
  console.log('✅ [STAGE 2] Expert answer generated:', JSON.stringify(expertJson).substring(0, 200) + '...');
  
  return expertJson;
}

// STAGE 3: Lightweight reviewer for correctness and polish
async function reviewAnswer(query: string, expertJson: any) {
  console.log('🔍 [STAGE 3] Reviewing answer for correctness...');

  const messages = [
    {
      role: "system",
      content: `You are a strict reviewer. Ensure:
- All manual facts are accurate and cited.
- Expert advice is clearly labeled as "expert".
- Steps are atomic and actionable (one action per step).
- No hallucinations about page numbers or labels.
Return corrected JSON only.`
    },
    {
      role: "user",
      content: `Question: ${query}

Answer to review:
${JSON.stringify(expertJson, null, 2)}

Review and correct if needed, maintaining the same JSON structure.`
    }
  ];

  const modelConfig = await getModelConfig(tenant_id || '00000000-0000-0000-0000-000000000001');
  
  const requestBody: any = {
    model: modelConfig.model,
    response_format: { type: "json_object" },
    [modelConfig.maxTokensParam]: 1200,
    messages
  };
  
  if (modelConfig.supportsTemperature) {
    requestBody.temperature = 0.2;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [STAGE 3] Review failed:', response.status, errorText);
    console.log('⚠️ Falling back to expert answer without review');
    return expertJson; // Fallback to expert answer if review fails
  }
  
  const data = await response.json();
  const reviewedJson = JSON.parse(data.choices[0].message.content);
  
  console.log('✅ [STAGE 3] Answer reviewed and polished');
  
  return reviewedJson;
}

// ============================================================
// UNIFIED RAG PIPELINE V2
// ============================================================
// Single entry point for the 3-stage RAG pipeline:
// 1. Retrieve chunks (with Cohere reranking)
// 2. Generate draft answer (manual-only)
// 3. Enhance with expert knowledge
// 4. Review for correctness
async function runRagPipelineV2(query: string, manual_id?: string, tenant_id?: string) {
  console.log('\n🚀 [RAG V2] Starting unified pipeline...\n');
  
  // Stage 0: Retrieve and rerank chunks
  const { results: chunks, strategy } = await searchChunks(query, manual_id, tenant_id);
  
  console.log(`📚 [RAG V2] Retrieved ${chunks.length} chunks using ${strategy} strategy`);
  
  if (chunks.length === 0) {
    return {
      response: "I couldn't find any relevant information in the manual for your question.",
      sources: [],
      strategy: 'none',
      pipeline_version: 'v2'
    };
  }

  // Answerability gate: Require at least ONE good score (rerank OR base)
  const maxRerankScore = Math.max(...chunks.map(c => c.rerank_score ?? 0));
  const maxBaseScore = Math.max(...chunks.map(c => c.score ?? 0));
  const hasGoodRerank = maxRerankScore >= 0.50; // Cohere score is decent
  const hasGoodBase = maxBaseScore >= 0.40; // Vector score is decent
  const weak = (chunks.length < 3) || (!hasGoodRerank && !hasGoodBase); // Weak only if BOTH scores are bad
  
  console.log(`📊 [RAG V2] Answerability check:`, {
    chunk_count: chunks.length,
    max_rerank_score: maxRerankScore.toFixed(3),
    max_base_score: maxBaseScore.toFixed(3),
    has_good_rerank: hasGoodRerank,
    has_good_base: hasGoodBase,
    is_weak: weak
  });
  
  if (weak) {
    console.log('⚠️ [RAG V2] Low answerability - returning early');
    const reason = chunks.length < 3 
      ? `only ${chunks.length} chunks found`
      : !hasGoodRerank 
        ? `low rerank scores (max: ${maxRerankScore.toFixed(2)})`
        : `low base scores (max: ${maxBaseScore.toFixed(2)})`;
    
    return {
      response: {
        summary: `I couldn't find relevant information in the manual to answer this question. The search ${reason}, which suggests this topic may not be covered in the manual.`,
        steps: [],
        why: [],
        expert_advice: [`This specific issue may not be documented in this manual. Consider checking if you're looking at the correct manual for your equipment.`],
        safety: [],
        sources: []
      },
      sources: chunks.map((chunk: any) => ({
        manual_id: chunk.manual_id,
        content: chunk.content.substring(0, 200) + "...",
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        score: chunk.score,
        rerank_score: chunk.rerank_score
      })),
      strategy,
      pipeline_version: 'v2'
    };
  }

  // Stage 1: Draft answer (manual only)
  console.log('📝 [RAG V2] Starting Stage 1: Draft Answer');
  const draftAnswer = await generateDraftAnswer(query, chunks);
  console.log('✅ [RAG V2] Stage 1 complete, draft length:', JSON.stringify(draftAnswer).length);
  
  // Stage 2: Expert enhancement
  console.log('🔧 [RAG V2] Starting Stage 2: Expert Enhancement');
  const expertAnswer = await generateExpertAnswer(query, draftAnswer);
  console.log('✅ [RAG V2] Stage 2 complete, expert answer length:', JSON.stringify(expertAnswer).length);
  
  // Stage 3: Review
  console.log('🔍 [RAG V2] Starting Stage 3: Review');
  const finalAnswer = await reviewAnswer(query, expertAnswer);
  console.log('✅ [RAG V2] Stage 3 complete, final answer length:', JSON.stringify(finalAnswer).length);

  console.log('✅ [RAG V2] Pipeline complete\n');

  return {
    response: finalAnswer,
    sources: chunks.map((chunk: any) => ({
      manual_id: chunk.manual_id,
      content: chunk.content.substring(0, 200) + "...",
      page_start: chunk.page_start,
      page_end: chunk.page_end,
      menu_path: chunk.menu_path,
      score: chunk.score,
      rerank_score: chunk.rerank_score
    })),
    strategy,
    chunks,
    pipeline_version: 'v2'
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

    // Extract tenant from auth header if available
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

    // Run V2 Pipeline
    console.log('🚀 Using RAG Pipeline V2\n');
    
    const result = await runRagPipelineV2(query, manual_id, tenant_id);
    
    const { response: finalAnswer, sources, strategy, chunks } = result;

    // Build metadata
    const metadata = {
      pipeline_version: 'v2',
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
      response: finalAnswer,
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
