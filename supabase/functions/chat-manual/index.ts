// supabase/functions/chat-manual/index.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Cache-Control": "no-store",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
const openaiProjectId = Deno.env.get("OPENAI_PROJECT_ID");
const CHAT_MODEL = Deno.env.get("CHAT_MODEL") ?? "gpt-5-2025-08-07";

// Validate required environment variables
if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!supabaseServiceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
if (!openaiApiKey) throw new Error("Missing OPENAI_API_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─────────────────────────────────────────────────────────────────────────
// Config lookup per-tenant
// ─────────────────────────────────────────────────────────────────────────
async function getModelConfig(tenant_id: string) {
  await supabase.rpc("set_tenant_context", { tenant_id });

  const { data: config } = await supabase
    .from("ai_config")
    .select("config_value")
    .eq("config_key", "chat_model")
    .single();

  let model = "gpt-5"; // Default
  if (config?.config_value) {
    const value = config.config_value;
    if (typeof value === "string" && (value.startsWith("gpt-") || value.startsWith("claude-"))) {
      model = value;
    } else if (typeof value === "string") {
      try {
        model = JSON.parse(value);
      } catch {
        model = value;
      }
    } else {
      // if stored as JSON
      // deno-lint-ignore no-explicit-any
      model = (value as any) ?? model;
    }
  }

  const isGpt5 = model.includes("gpt-5");
  return {
    model,
    maxTokensParam: isGpt5 ? "max_output_tokens" : "max_tokens",
    supportsTemperature: !isGpt5,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Query helpers: normalize + symptom expansion
// ─────────────────────────────────────────────────────────────────────────
function normalizeQuery(q: string) {
  return q.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
}

function expandQuery(q: string) {
  const n = normalizeQuery(q);
  // seed rule for “balls won’t come out / stuck”
  const ballRule =
    /balls?.*?(won(?:'|’)?t|wont|do(?:'|’)?nt|dont).*?(come\s*out|dispense|release)|balls?.*?(stuck|jam)/i;
  if (ballRule.test(n)) {
    const syn = [
      "ball gate",
      "ball release",
      "gate motor",
      "gate open sensor",
      "gate closed sensor",
      "ball diverter",
    ];
    return `${n}\nSynonyms: ${syn.join(", ")}`;
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────────────
// Keyword helpers you already had
// ─────────────────────────────────────────────────────────────────────────
function keywordLine(q: string): string {
  const toks =
    q.match(/\b(CR-?2032|CMOS|BIOS|HDMI|VGA|J\d+|pin\s?\d+|[0-9]+V|5V|12V|error\s?E-?\d+)\b/gi) || [];
  return [...new Set(toks)].join(" ");
}

function tokenBoost(text: string): number {
  return /\b(CR-?2032|CMOS|BIOS|HDMI|J\d+|pin\s?\d+|[0-9]+V)\b/i.test(text) ? 0.15 : 0;
}

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

function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

// ─────────────────────────────────────────────────────────────────────────
// Fetch helper (logs HTTP body on non-2xx)
// ─────────────────────────────────────────────────────────────────────────
async function fetchJsonOrThrow(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    console.error("❌ HTTP", res.status, url, "body:", text.slice(0, 2000));
    throw new Error(`${url} -> ${res.status} ${text}`);
  }
  return JSON.parse(text);
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAI Embedding
// ─────────────────────────────────────────────────────────────────────────
async function createEmbedding(text: string) {
  return await fetchJsonOrThrow("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  }).then((data) => data.data[0].embedding);
}

// ─────────────────────────────────────────────────────────────────────────
// Search for relevant chunks using hybrid approach
// ─────────────────────────────────────────────────────────────────────────
async function searchChunks(query: string, manual_id?: string, tenant_id?: string) {
  const startTime = Date.now();

  const expanded = expandQuery(query);
  const keywords = keywordLine(expanded);
  const hybridQuery = keywords ? `${expanded}\nKeywords: ${keywords}` : expanded;

  console.log("🔍 Starting hybrid search:", query.substring(0, 120));
  if (keywords) console.log("🔑 Keywords:", keywords);

  const queryEmbedding = await createEmbedding(hybridQuery);
  console.log("✅ Created query embedding");

  const { data: vectorResults, error: vectorError } = await supabase.rpc("match_chunks_improved", {
    query_embedding: queryEmbedding,
    top_k: 60,
    min_score: 0.3,
    manual: manual_id,
    tenant_id: tenant_id,
  });

  if (vectorError) {
    console.error("❌ Vector search error:", vectorError);
  }

  // normalize DB rows -> { content: string, ... }
  function normalizeRow(r: any) {
    const t =
      typeof r.content === "string"
        ? r.content
        : typeof r.chunk_text === "string"
        ? r.chunk_text
        : typeof r.text === "string"
        ? r.text
        : JSON.stringify(r.content ?? r.chunk_text ?? r.text ?? "");
    return { ...r, content: t };
  }

  const candidates = (vectorResults || []).map(normalizeRow);
  console.log(`📊 Vector search found ${candidates.length} results`);

  const strategy = candidates.length > 0 ? "vector" : "none";

  // Cohere rerank
  let finalResults: any[] = [];
  if (candidates.length > 0) {
    try {
      const cohereApiKey = Deno.env.get("COHERE_API_KEY");
      if (!cohereApiKey) {
        console.warn("⚠️ COHERE_API_KEY not found, skipping rerank");
        finalResults = candidates.slice(0, 10);
      } else {
        console.log("🔄 Reranking with Cohere...");
        const truncatedDocs = candidates.map((c) => {
          const s = typeof c.content === "string" ? c.content : JSON.stringify(c.content ?? "");
          return s.length > 1500 ? s.slice(0, 1500) : s;
        });

        const cohereRes = await fetch("https://api.cohere.ai/v1/rerank", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cohereApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "rerank-english-v3.0",
            query: expanded ?? query,
            documents: truncatedDocs,
            top_n: Math.min(10, truncatedDocs.length),
          }),
        });

        if (!cohereRes.ok) {
          const errorText = await cohereRes.text();
          console.error("❌ Cohere rerank failed:", cohereRes.status, errorText.slice(0, 500));
          finalResults = candidates.slice(0, 10);
        } else {
          const rerank = await cohereRes.json();
          finalResults = (rerank.results || [])
            .filter((r: any) => Number.isInteger(r.index) && candidates[r.index])
            .map((r: any) => ({
              ...candidates[r.index],
              rerank_score: typeof r.relevance_score === "number" ? r.relevance_score : undefined,
              original_score: candidates[r.index].score,
            }));

          if (finalResults.length < 10) {
            const seen = new Set(
              finalResults.map(
                (x) => x.id ?? `${x.page_start}:${x.page_end}:${(x.content || "").slice(0, 40)}`
              )
            );
            for (const c of candidates) {
              const key = c.id ?? `${c.page_start}:${c.page_end}:${(c.content || "").slice(0, 40)}`;
              if (!seen.has(key)) {
                finalResults.push(c);
                if (finalResults.length >= 10) break;
              }
            }
          }
          console.log(`✅ Reranked to top ${finalResults.length} results`);
        }
      }
    } catch (error) {
      console.error("❌ Rerank error:", error);
      finalResults = candidates.slice(0, 10);
    }
  }

  const searchTime = Date.now() - startTime;
  console.log(`⏱️ Search completed in ${searchTime}ms`);

  return { results: finalResults, strategy };
}

// ─────────────────────────────────────────────────────────────────────────
// Model-aware answer generation
// ─────────────────────────────────────────────────────────────────────────
function isGpt5(model: string): boolean {
  return model.includes("gpt-5");
}

async function generateAnswer(query: string, chunks: any[], model: string): Promise<string> {
  const contextBlocks = chunks
    .map((c, i) => {
      const pageInfo = c.page_start
        ? c.page_end && c.page_end !== c.page_start
          ? `[p${c.page_start}-${c.page_end}]`
          : `[p${c.page_start}]`
        : "[page unknown]";
      return `[${i + 1}] ${pageInfo} ${c.content}`;
    })
    .join("\n\n");

  const systemPrompt = `You are an expert arcade service assistant. You must give repair steps that a field tech can do in under 3 minutes.

Rules
1) Map the symptom to the likely subsystem by name.
2) Output 2–4 decisive tests with numbers, pins, connectors, or error codes.
3) Each test must cite an exact page from the provided context. If a step has no page, omit it.
4) Prefer procedures and wiring tables over parts lists. Prefer pages with voltages, pins, or headers (e.g., Jxx).
5) Stop when a fault is confirmed; don’t list speculative branches.
6) If evidence is thin, return the “Minimal Working Play” (error display → sensor toggle 0↔5 V → power/drive check) and say what data is missing.

Format
**Subsystem:** <name>

**Do this first (2–4 steps):**
1) <Test with expected reading, connector/pin>  — p<X>
2) ...
3) ...

**Why:** <one-line rationale>

**Citations:** p<X>, p<Y>, p<Z>`;

  const userPrompt = `Question: ${query}

Manual content:
${contextBlocks}

Provide a clear answer using the manual content above.`;

  console.log(`🤖 Generating answer with model: ${model}`);

  const url = isGpt5(model)
    ? "https://api.openai.com/v1/responses"
    : "https://api.openai.com/v1/chat/completions";

  const body: any = isGpt5(model)
    ? {
        model,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_output_tokens: 8000, // Increased for reasoning + answer
      }
    : {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
      };

  console.log(`📤 Calling ${url} with model ${model}`);
  console.log(`📝 Body preview:`, JSON.stringify(body).slice(0, 400));

  const data = await fetchJsonOrThrow(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify(body),
  });

  console.log("📦 OpenAI response usage:", data.usage);

  const answerText = isGpt5(model)
    ? (data.output_text ??
       data.choices?.[0]?.message?.content ??
       data.output?.[1]?.content?.[0]?.text ??
       "")
    : (data.choices?.[0]?.message?.content ?? "");

  if (!answerText || answerText.trim() === "") {
    console.error("❌ Empty answer from model. Response:", JSON.stringify(data, null, 2));
    throw new Error("Model returned an empty response");
  }

  console.log("✅ Answer generated:", answerText.substring(0, 100) + "...");
  return answerText;
}

// ─────────────────────────────────────────────────────────────────────────
// Fallback answer generator for weak/empty retrieval
// ─────────────────────────────────────────────────────────────────────────
function buildFallbackFor(query: string) {
  const q = query.toLowerCase();
  const isNoBalls =
    /balls/.test(q) &&
    ((/(won|wont|don|dont)/.test(q) && /(come out|dispense|release)/.test(q)) || /(stuck|jam)/.test(q));
  if (isNoBalls) {
    return `**Subsystem:** Ball Gate

**Do this first (2–4 steps):**
1) [Field] Enter Error Display; if a Ball Gate error shows, note the code.
2) [Field] Watch the gate after swipe: if the motor doesn’t twitch, check +12 V at the gate harness and continuity back to the I/O board (J14).
3) [Field] Check the two gate sensors: they must toggle when the magnet passes (seen in inputs or with a meter). If no toggle, reseat/replace sensor or wiring.
4) [Field] Open the gate cover and remove any screws/debris binding the gate. Do not force the gate by hand.

**Why:** If the controller can’t drive the gate or see the sensors toggle, it won’t release balls.`;
  }
  return `**Subsystem:** General

**Do this first (2–4 steps):**
1) [Field] Check stored errors/LED codes and note them.
2) [Field] Power sanity (+5 V and +12 V) at the I/O board.
3) [Field] Exercise the actuator/sensor once while watching inputs.
4) [Field] Reseat connectors; look for bent/oxidized pins.

**Why:** Most “no-action” faults are power/sensor/drive basics.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────────────────
async function runRagPipelineV3(query: string, manual_id?: string, tenant_id?: string, model?: string) {
  console.log("\n🚀 [RAG V3] Starting simplified pipeline...\n");

  const { results: chunks, strategy } = await searchChunks(query, manual_id, tenant_id);
  console.log(`📊 Retrieved ${chunks.length} chunks after reranking`);

  if (!chunks || chunks.length === 0) {
    const fallback = buildFallbackFor(query);
    return {
      answer: fallback,
      sources: [],
      strategy: "none",
      pipeline_version: "v3",
      gate_reason: "insufficient_manual_evidence",
    };
  }

  const maxRerankScore = Math.max(...chunks.map((c) => c.rerank_score ?? 0));
  const maxBaseScore = Math.max(...chunks.map((c) => c.score ?? 0));
  const hasGoodRerank = maxRerankScore >= 0.45;
  const hasGoodBase = maxBaseScore >= 0.35;
  const weak = chunks.length < 3 || (!hasGoodRerank && !hasGoodBase);

  console.log(`📊 Answerability check:`, {
    chunk_count: chunks.length,
    max_rerank: maxRerankScore.toFixed(3),
    max_base: maxBaseScore.toFixed(3),
    is_weak: weak,
  });

  if (weak) {
    const fallback = buildFallbackFor(query);
    return {
      answer: fallback,
      sources: chunks.slice(0, 3).map((c: any) => ({
        page_start: c.page_start,
        page_end: c.page_end,
        content: (c.content || "").substring(0, 200),
        score: c.score,
      })),
      strategy,
      pipeline_version: "v3",
      gate_reason: "insufficient_quality",
    };
  }

  const topChunks = chunks.slice(0, 10);

  console.log(`🎯 STAGE 1: Generating answer with model: ${model || CHAT_MODEL}`);
  const answer = await generateAnswer(query, topChunks, model || CHAT_MODEL);

  console.log("✅ [RAG V3] Pipeline complete\n");

  return {
    answer,
    sources: topChunks.map((c: any) => ({
      manual_id: c.manual_id,
      content: c.content.substring(0, 200) + "...",
      page_start: c.page_start,
      page_end: c.page_end,
      menu_path: c.menu_path,
      score: c.score,
      rerank_score: c.rerank_score,
    })),
    strategy,
    chunks: topChunks,
    pipeline_version: "v3",
  };
}

// ─────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "chat-manual",
        version: "v3",
        environment: {
          has_openai_key: !!openaiApiKey,
          has_cohere_key: !!Deno.env.get("COHERE_API_KEY"),
          has_supabase_url: !!supabaseUrl,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { query, manual_id } = await req.json();
    if (!query) throw new Error("Query is required");

    console.log("\n=================================");
    console.log("🔍 NEW CHAT REQUEST");
    console.log("Query:", query);
    console.log("Manual ID:", manual_id || "All manuals");
    console.log("=================================\n");

    // Extract tenant from auth header
    const authHeader = req.headers.get("authorization");
    let tenant_id: string | undefined;

    if (authHeader) {
      const jwt = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabase.auth.getUser(jwt);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("fec_tenant_id")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          tenant_id = profile.fec_tenant_id;
          await supabase.rpc("set_tenant_context", { tenant_id });
          console.log("👤 Tenant ID:", tenant_id);
        }
      }
    }

    // Get model configuration for tenant (if available)
    let model = CHAT_MODEL;
    if (tenant_id) {
      try {
        const cfg = await getModelConfig(tenant_id);
        model = cfg.model || model;
        console.log(`📝 Using configured model: ${model}`);
      } catch (e) {
        console.warn("⚠️ Failed to get model config, using default:", e);
      }
    }

    // Run pipeline
    console.log("🚀 Using RAG Pipeline V3\n");
    const result = await runRagPipelineV3(query, manual_id, tenant_id, model);

    const { answer, sources, strategy, chunks } = result;

    const metadata = {
      pipeline_version: "v3",
      manual_id: manual_id || "all_manuals",
      embedding_model: "text-embedding-3-small",
      retrieval_strategy: strategy,
      candidate_count: chunks?.length || 0,
      rerank_scores: chunks?.slice(0, 10).map((c) => c.rerank_score ?? null) || [],
    };

    const contextSeen =
      chunks
        ?.map((chunk) => {
          const pageInfo = chunk.page_start
            ? `[Pages ${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ""}]`
            : "";
          const pathInfo = chunk.menu_path ? `[${chunk.menu_path}]` : "";
          return `${pageInfo}${pathInfo ? " " + pathInfo : ""}\n${chunk.content}`;
        })
        .join("\n\n---\n\n") || "";

    return new Response(
      JSON.stringify({
        answer,
        sources,
        strategy,
        metadata,
        context_seen: contextSeen,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ CHAT ERROR:", error);
    console.error("Error type:", typeof error);
    console.error("Error name:", error instanceof Error ? error.name : "unknown");
    console.error("Error message:", error instanceof Error ? error.message : JSON.stringify(error));
    console.error("Stack:", error instanceof Error ? error.stack : "No stack trace");

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined,
        sources: [],
        strategy: "error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
