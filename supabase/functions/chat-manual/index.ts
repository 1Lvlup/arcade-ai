// supabase/functions/chat-manual/index.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeSignals, shapeMessages } from "../_shared/answerStyle.ts";
import { buildCitationsAndImages } from "../_shared/rag.ts";

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

// BACKEND_MODEL: Used for internal RAG operations (embeddings, etc.) - defaults to gpt-5-2025-08-07
// The actual chat model for user responses comes from database ai_config table (chat_model)
const BACKEND_MODEL = Deno.env.get("BACKEND_MODEL") ?? "gpt-5-2025-08-07";
// CHAT_MODEL: Fallback if database lookup fails (deprecated, use ai_config table instead)
const CHAT_MODEL = Deno.env.get("CHAT_MODEL") ?? "gpt-5-2025-08-07";

// tone: "conversational" | "structured"
const ANSWER_STYLE = Deno.env.get("ANSWER_STYLE") ?? "conversational";
// Feature flag for advanced answer style V2
const USE_ANSWER_STYLE_V2 = (Deno.env.get("ANSWER_STYLE_V2") ?? "0") === "1";

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

  let model = "gpt-5-2025-08-07"; // Default
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
    maxTokensParam: isGpt5 ? "max_completion_tokens" : "max_tokens", // GPT-5 requires max_completion_tokens
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
    const syn = ["ball gate", "ball release", "gate motor", "gate open sensor", "gate closed sensor", "ball diverter"];
    return `${n}\nSynonyms: ${syn.join(", ")}`;
  }
  return n;
}

// ── Optional style hint detector (lets users ask “explain like a 5th grader”) ──
function styleHintFromQuery(q: string): string {
  const s = q.toLowerCase();
  if (/(5th|fifth)\s+grader|explain.*like.*(5|five)th/.test(s)) {
    return "Write for a 5th grader: short sentences, everyday words, no jargon. Define any technical term in one simple line. Explain step by step";
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────
// Keyword helpers you already had
// ─────────────────────────────────────────────────────────────────────────
// ── Mode picker for Rundown vs Default ──
function pickModeFromQuery(q: string): "rundown" | "default" {
  const s = q.toLowerCase();
  return /(overview|rundown|architecture|how does|what is|components)/i.test(s) ? "rundown" : "default";
}

function keywordLine(q: string): string {
  const toks = q.match(/\b(CR-?2032|CMOS|BIOS|HDMI|VGA|J\d+|pin\s?\d+|[0-9]+V|5V|12V|error\s?E-?\d+)\b/gi) || [];
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
// Spec/connector bias helpers
// ─────────────────────────────────────────────────────────────────────────
function looksSpecy(t: string) {
  const s = (t || "").toLowerCase();
  return /(?:\b[0-9]+(?:\.[0-9]+)?\s*(v|vac|vdc|ma|ohm|Ω|amp|a)\b|\bj\d{1,3}\b|\bpin\s*\d+\b|\bfuse\s*f?\d+\b)/i.test(s);
}

function boostSpecCandidates(rows: any[], query: string) {
  const specIntent = /\b(spec|voltage|power|pin|connector|header|fuse|ohm|current|ma|vdc|vac)\b/i.test(query);
  if (!specIntent) return rows;
  // prefer rows with numbers/units/connectors on top
  return [...rows].sort((a, b) => {
    const A = looksSpecy(a.content) ? 1 : 0;
    const B = looksSpecy(b.content) ? 1 : 0;
    if (A !== B) return B - A;
    return (b.rerank_score ?? b.score ?? 0) - (a.rerank_score ?? a.score ?? 0);
  });
}

function expandIfWeak(query: string) {
  // smart expansion for power/spec hunts
  return `${query} power OR voltage OR VDC OR VAC OR connector OR header OR J1 OR J2 OR fuse OR pin OR ohm`;
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
// Search using unified search endpoint with Cohere reranking
// ─────────────────────────────────────────────────────────────────────────
async function searchChunks(query: string, manual_id?: string, tenant_id?: string) {
  const startTime = Date.now();

  const expanded = expandQuery(query);
  const keywords = keywordLine(expanded);
  const hybridQuery = keywords ? `${expanded}\nKeywords: ${keywords}` : expanded;

  console.log("🔍 Using unified search:", query.substring(0, 120));
  if (keywords) console.log("🔑 Keywords:", keywords);

  try {
    // Call unified search function
    const searchResponse = await supabase.functions.invoke('search-unified', {
      body: {
        query: hybridQuery,
        manual_id: manual_id,
        tenant_id: tenant_id,
        top_k: 60,
      },
    });

    if (searchResponse.error) {
      console.error("❌ Unified search error:", searchResponse.error);
      // Fallback to direct vector search
      return await fallbackVectorSearch(hybridQuery, manual_id, tenant_id);
    }

    const { results = [] } = searchResponse.data || {};
    console.log(`✅ Unified search returned ${results.length} results in ${Date.now() - startTime}ms`);

    // Normalize DB rows
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

    const finalCandidates = results.map(normalizeRow);

  // Apply spec bias
  let candidatesBiased = boostSpecCandidates(finalCandidates, query);

  // Weak-evidence fallback: if almost none look "specy", requery with expansion
  const specish = candidatesBiased.filter(r => looksSpecy(r.content)).length;
  if (candidatesBiased.length < 3 || specish < 2) {
    const expandedQ = expandIfWeak(query);
  return finalCandidates;
}

// Fallback to direct vector search if unified endpoint fails
async function fallbackVectorSearch(query: string, manual_id?: string, tenant_id?: string) {
  console.log("⚠️ Using fallback vector search");
  
  const queryEmbedding = await createEmbedding(query);
  
  const { data: vectorResults, error: vectorError } = await supabase.rpc("match_chunks_improved", {
    query_embedding: queryEmbedding,
    top_k: 60,
    min_score: 0.3,
    manual: manual_id,
    tenant_id: tenant_id,
  });

  if (vectorError) {
    console.error("❌ Vector search error:", vectorError);
    return [];
  }

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
  console.log(`📊 Fallback returned ${candidates.length} results`);
  
  return candidates.slice(0, 10);

  const searchTime = Date.now() - startTime;
  console.log(`⏱️ Search completed in ${searchTime}ms`);

  return { results: finalResults, strategy };
}

// ─────────────────────────────────────────────────────────────────────────
// Text normalization helpers
// ─────────────────────────────────────────────────────────────────────────
/** Collapse "H Y P E R  B O W L I N G", "H\n * Y\n * P\n * E\n * R", and mixed cases into normal words. */
function collapseSpacedLetters(s: string) {
  // join single letters separated by spaces: H Y P E R → HYPER
  s = s.replace(/\b([A-Z])(?:\s+([A-Z])){2,}\b/g, (m) => m.replace(/\s+/g, ""));

  // join single letters separated by newlines: H\nY\nP\nE\nR → HYPER
  s = s.replace(/\b(?:[A-Z]\s*(?:\r?\n|\r)\s*){2,}[A-Z]\b/g, (m) =>
    m.replace(/[\s\r\n]+/g, "")
  );

  // handle mixed case/accidentally spaced words like i n s t a l l a t i o n
  s = s.replace(/\b([a-z])(?:\s+([a-z])){3,}\b/g, (m) => m.replace(/\s+/g, ""));

  return s;
}

/** Final pass that removes page marks, HTML comments, duplicates and squashes whitespace. */
function normalizeGist(raw: string) {
  let s = String(raw ?? "");

  // Remove HTML comments like <!-- Page 4 End --> etc.
  s = s.replace(/<!--[\s\S]{0,500}?-->/g, " ");

  // Remove pure page headers/footers like "Page 12", "Page II", "#" etc., but
  // DO NOT remove the word "page" in normal sentences.
  s = s.replace(/\bPage\s+(?:[0-9IVX]+)\b/gi, " ");
  s = s.replace(/^\s*#\s*Page\s+[0-9IVX]+\s*$/gim, " ");

  // Remove P/N and REV lines only when they actually look like codes
  s = s.replace(/\bP\/N\s*[:#]?\s*[A-Z0-9\-\.]{3,}\b/gi, " ");
  s = s.replace(/\bREV\.?\s*[A-Z]?(?:,\s*)?\d{1,2}\/\d{2}\b/gi, " ");

  // Turn hard line breaks into spaces early so we can collapse letter-per-line
  s = s.replace(/[\r\n]+/g, " ");

  // Now fix the spaced-letter artifacts
  s = collapseSpacedLetters(s);

  // Kill leftover "single-letter parade" runs (>=5 letters): H Y P E R … → HYPER
  s = s.replace(
    /\b(?:[A-Za-z]\s+){4,}[A-Za-z]\b/g,
    (m) => m.replace(/\s+/g, "")
  );

  // Un-hyphenate line-break splits like "elec-\ntronics"
  s = s.replace(/(\w)[-–]\s+(\w)/g, "$1$2");

  // Collapse excessive spacing
  s = s.replace(/[·•●▪︎◦_]+/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

// ─────────────────────────────────────────────────────────────────────────
// Model-aware answer generation
// ─────────────────────────────────────────────────────────────────────────
function isGpt5(model: string): boolean {
  return model.includes("gpt-5");
}

const SYSTEM_PROMPT_CONVERSATIONAL = `
You are "Dream Technician Assistant," a friendly, insanely competent arcade/bowling tech coach.
Talk like a trusted coworker who thinks ahead and helps prevent future issues.

ANSWER STRUCTURE:
1. Direct answer (2-3 sentences addressing the main issue)
2. Why it matters (brief explanation of root cause)
3. Step-by-step actions (4-6 concrete bullets with specifics)
4. Related considerations (mention 1-2 related things that could go wrong or should be checked while you're in there)
5. Next steps guidance (2-3 leading questions to help the tech decide what to investigate next)

RULES:
- Be thorough but practical - think about the full repair context
- Cite sources inline like (Manual p. 12) when you use manual info
- Never invent specs, part numbers, or connector IDs - if missing say "spec not in manual"
- Mention power-off for any resistance checks or moving parts
- Use plain action verbs: "unplug, reseat, measure, check"
- When suggesting checks, include what readings/results to expect

LEADING QUESTIONS FORMAT (always include at end):
"What to check next:"
• [Question about related system/component]?
• [Question about symptom progression or related issue]?
• [Question to narrow down root cause]?

Keep it conversational and helpful - you're saving them a second trip!
`;

const SYSTEM_PROMPT_STRUCTURED = `You are an expert arcade service assistant. Give **actionable** repair steps a field tech can follow safely on-site.

Rules
1) Map the symptom to the likely subsystem by name.
2) Output 2–4 decisive tests with numbers, pins, connectors, or error codes.
3) Each test must cite an exact page from the provided context. If a step has no page, omit it.
4) Prefer procedures and wiring tables over parts lists. Prefer pages with voltages, pins, or headers (e.g., Jxx).
5) If you tell the user to enter any **menu/diagnostic mode**, briefly include **how to open it** (button names or sequence) if it isn't obvious from context.
6) Stop when a fault is confirmed; don't list speculative branches.
7) If evidence is thin, return the "Minimal Working Play" (error display → sensor toggle 0↔5 V → power/drive check) and say what data is missing.

Format
**Subsystem:** <name>

**Do this first (2–4 steps):**
1) <Test with expected reading, connector/pin>  — p<X>
2) ...
3) ...

**Why:** <one-line rationale>

**Citations:** p<X>, p<Y>, p<Z>`;

async function generateAnswer(
  query: string, 
  chunks: any[], 
  model: string, 
  opts?: { 
    retrievalWeak?: boolean;
    signals?: { topScore: number; avgTop3: number; strongHits: number };
    existingWeak?: boolean;
    stream?: boolean;
    conversationHistory?: Array<{ role: string; content: string }>;
  }
): Promise<string | ReadableStream> {
  let systemPrompt: string;
  let userPrompt: string;

  // Use Answer Style V2 if enabled
  if (USE_ANSWER_STYLE_V2 && opts?.signals) {
    const snippets = chunks.map((c, i) => {
      const cleaned = normalizeGist(c.content);
      const pageInfo = c.page_start
        ? (c.page_end && c.page_end !== c.page_start ? `p${c.page_start}-${c.page_end}` : `p${c.page_start}`)
        : "page unknown";
      return {
        title: `Chunk ${i + 1}`,
        excerpt: cleaned,
        cite: pageInfo
      };
    });

    const shaped = shapeMessages(query, snippets, {
      existingWeak: opts.existingWeak ?? false,
      topScore: opts.signals.topScore,
      avgTop3: opts.signals.avgTop3,
      strongHits: opts.signals.strongHits
    });

    systemPrompt = shaped.system;
    userPrompt = shaped.user;

    console.log(`📊 [Answer Style V2] Weak: ${shaped.isWeak}, Top: ${opts.signals.topScore.toFixed(3)}, Avg3: ${opts.signals.avgTop3.toFixed(3)}, Strong: ${opts.signals.strongHits}`);
  } else {
    // Original behavior
    const contextBlocks = chunks
      .map((c, i) => {
        const cleaned = normalizeGist(c.content);
        const pageInfo = c.page_start
          ? (c.page_end && c.page_end !== c.page_start ? `[p${c.page_start}-${c.page_end}]` : `[p${c.page_start}]`)
          : "[page unknown]";
        return `[${i + 1}] ${pageInfo} ${cleaned}`;
      })
      .join("\n\n");

    systemPrompt = ANSWER_STYLE === "conversational"
      ? SYSTEM_PROMPT_CONVERSATIONAL
      : SYSTEM_PROMPT_STRUCTURED;

    userPrompt = `Question: ${query}

Manual content:
${contextBlocks}

Provide a clear answer using the manual content above.`;

    const styleHint = styleHintFromQuery(query);
    
    if (styleHint) {
      userPrompt += `

Style request:
${styleHint}`;
    }

    if (opts?.retrievalWeak) {
      userPrompt += `

(Notes for the assistant: Retrieval was thin. Still answer decisively using "field-tested play". Be clear when specs are missing with "spec not captured". Keep tone confident and helpful.)`;
    }
  }
  
  console.log(`🤖 Generating answer with model: ${model}`);

  // Use Responses API for better performance and caching
  const url = "https://api.openai.com/v1/responses";

  // Build input array with conversation history (Responses API uses "input" instead of "messages")
  const conversationInput = [
    { role: "system", content: systemPrompt },
    ...(opts?.conversationHistory || []),
    { role: "user", content: userPrompt },
  ];

  const body: any = isGpt5(model)
    ? {
        model,
        input: conversationInput, // Responses API uses "input"
        max_output_tokens: 8000, // Responses API uses "max_output_tokens"
        // reasoning parameter removed - not supported by gpt-5-chat-latest on Responses API
        stream: true, // Explicitly true
        store: true, // Enable stateful context for better performance
      }
    : {
        model,
        input: conversationInput, // Responses API uses "input"
        max_output_tokens: 2000,
        stream: true, // Explicitly true
        store: true,
      };

  console.log(`📤 [Responses API] Calling ${url} with model ${model}`);
  console.log(`📝 Body preview:`, JSON.stringify(body).slice(0, 400));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ OpenAI API error:", errorText);
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  // Transform Responses API stream to Chat Completions API format
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  const transformedStream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue;
            
            if (line.startsWith('event:')) {
              // Skip event lines, we'll process the data lines
              continue;
            }
            
            if (line.startsWith('data: ')) {
              const dataContent = line.slice(6);
              
              if (dataContent === '[DONE]') {
                // Transform to Chat Completions format
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                continue;
              }
              
              try {
                const parsed = JSON.parse(dataContent);
                
                // Transform Responses API format to Chat Completions format
                if (parsed.delta) {
                  const transformed = {
                    choices: [{
                      delta: {
                        content: parsed.delta
                      }
                    }]
                  };
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(transformed)}\n\n`));
                }
              } catch (e) {
                console.error('Error parsing Responses API data:', e);
              }
            }
          }
        }
        
        controller.close();
      } catch (error) {
        console.error('Stream transformation error:', error);
        controller.error(error);
      }
    }
  });

  return transformedStream;
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
async function runRagPipelineV3(
  query: string, 
  manual_id?: string, 
  tenant_id?: string, 
  model?: string,
  conversationHistory?: Array<{ role: string; content: string }>
) {
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
    console.log("⚠️ Weak evidence detected — proceeding with model anyway using available manual chunks.");
    // No early return. We still call the model with topChunks so it must use whatever citations we have.
  }

  const topChunks = chunks.slice(0, 10);

  // Quality check: ensure we have substantive evidence before answering
  const pages = new Set(topChunks.map(c => c.page_start).filter(Boolean));
  const hasRealPages = pages.size >= 2 && !pages.has(1);
  const hasSpecTokens = topChunks.some(c => looksSpecy(c.content));
  const hasGoodContent = topChunks.some(c => c.content && c.content.length > 100);

  // Only ask clarifying questions if we truly have no useful content
  if (!hasRealPages && !hasSpecTokens && !hasGoodContent) {
    console.log("⚠️ Insufficient specific evidence - asking clarifying question");
    const q = query.toLowerCase();
    
    // Generate a conversational clarifying response
    const clarificationPrompt = `You are a helpful arcade technician assistant. A user asked: "${query}"

You don't have specific manual documentation for this exact query. Instead of giving up, ask a friendly clarifying question to help narrow down what they need.

Be conversational and helpful. For example:
- If they ask about a sensor, ask which specific sensor or which part of the machine
- If they ask about power, ask what component or where they're measuring
- If they're asking about a part location, ask them to describe what they're looking at

Keep it short (2-3 sentences max) and friendly.`;

    const clarification = await fetchJsonOrThrow("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
        ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        max_completion_tokens: 150,
        messages: [{ role: "user", content: clarificationPrompt }],
      }),
    }).then(d => d.choices?.[0]?.message?.content ?? "Could you provide more details about what specifically you're trying to fix or locate?");

    return {
      answer: clarification,
      sources: [],
      strategy,
      chunks: topChunks,
      pipeline_version: "v3"
    };
  }

  console.log(`🎯 STAGE 1: Generating answer with model: ${model || CHAT_MODEL}`);
  const retrievalWeak = weak || topChunks.length < 2;
  
  // Compute signals for Answer Style V2
  const signals = computeSignals(chunks.map(c => ({ score: c.rerank_score ?? c.score ?? 0 })));
  
  const answer = await generateAnswer(query, topChunks, model || CHAT_MODEL, { 
    retrievalWeak,
    signals,
    existingWeak: weak,
    stream: false,
    conversationHistory
  });

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
    const { query, manual_id, stream, messages } = await req.json();
    if (!query) throw new Error("Query is required");

    console.log("\n=================================");
    console.log("🔍 NEW CHAT REQUEST");
    console.log("Query:", query);
    console.log("Manual ID:", manual_id || "All manuals");
    console.log("Stream:", stream || false);
    console.log("=================================\n");

    // Check for Rundown Mode
    const mode = pickModeFromQuery(query);
    console.log("RUNDOWN MODE?", { mode, query });

    if (mode === "rundown" && Deno.env.get("ENABLE_RUNDOWN") === "true") {
      const r = await fetch(`${supabaseUrl}/functions/v1/search-rundown-v1`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ q: query, manual_id: manual_id ?? null, system: null, vendor: null, limit: 80 })
      });
      const data = await r.json();

      const answer =
        data?.ok
          ? [`SUMMARY: ${data.summary}`, ...(data.sections || []).map((s: any) => `\n## ${s.title}\n${s.gist}`).join("\n")].join("\n")
          : `Rundown unavailable: ${data?.error || "unknown error"}`;

      return new Response(JSON.stringify({
        answer,
        sources: data?.sections?.flatMap((s: any) => s.citations || []) ?? [],
        strategy: "rundown",
        metadata: { pipeline_version: "v3", mode: "rundown" },
        context_seen: ""
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
    
    // If streaming is requested, handle it differently
    if (stream) {
      console.log("📡 Starting streaming response");
      const result = await runRagPipelineV3(query, manual_id, tenant_id, model, messages);
      const { sources, strategy, chunks } = result;
      
      // Log the query to get query_log_id for feedback
      let queryLogId = null;
      try {
        const { data: logData, error: logError } = await supabase
          .from('query_logs')
          .insert({
            query_text: query,
            manual_id: manual_id || null,
            fec_tenant_id: tenant_id || null,
            retrieval_method: strategy,
            model_name: model,
          })
          .select('id')
          .single();

        if (!logError && logData) {
          queryLogId = logData.id;
        }
      } catch (e) {
        console.error('Error logging query:', e);
      }
      
      // Get the answer stream with conversation history
      const answerStream = await generateAnswer(query, chunks || [], model, {
        retrievalWeak: false,
        stream: true,
        conversationHistory: messages
      }) as ReadableStream;
      
      // Create a new stream that sends metadata first, then the answer
      const streamWithMetadata = new ReadableStream({
        async start(controller) {
          // Build citations and retrieve images based on chunks used
          const chunkIds = (chunks || []).map(c => c.id).filter(Boolean);
          let thumbnails: any[] = [];
          
          if (chunkIds.length > 0) {
            try {
              const { thumbnails: imgs } = await buildCitationsAndImages(supabase, chunkIds, manual_id);
              thumbnails = imgs || [];
              console.log(`🖼️ Retrieved ${thumbnails.length} images for manual: ${manual_id || 'all'}`);
            } catch (e) {
              console.error('Error fetching images:', e);
            }
          }
          
          // Get manual title if manual_id is specified
          let manualTitle = null;
          if (manual_id) {
            try {
              const { data: manualData } = await supabase
                .from('manual_metadata')
                .select('canonical_title')
                .eq('manual_id', manual_id)
                .single();
              manualTitle = manualData?.canonical_title || null;
            } catch (e) {
              console.error('Error fetching manual title:', e);
            }
          }
          
          // Send metadata first (including query_log_id for feedback and thumbnails)
          const metadata = {
            type: 'metadata',
            data: {
              sources: sources?.slice(0, 5).map(s => ({
                page_start: s.page_start,
                page_end: s.page_end,
              })) || [],
              strategy,
              query_log_id: queryLogId,
              thumbnails,
              manual_id: manual_id || null,
              manual_title: manualTitle
            }
          };
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(metadata)}\n\n`));
          
          // Stream the answer
          const reader = answerStream.getReader();
          const decoder = new TextDecoder();
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const text = decoder.decode(value, { stream: true });
              const lines = text.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') continue;
                  
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      const chunk = {
                        type: 'content',
                        data: content
                      };
                      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }
            
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          }
        }
      });
      
      return new Response(streamWithMetadata, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    const result = await runRagPipelineV3(query, manual_id, tenant_id, model, messages);

    const { answer, sources, strategy, chunks } = result;

    // ============ AUTOMATED QUALITY CHECKS FOR TRAINING ============
    const response_text = typeof answer === 'string' ? answer : JSON.stringify(answer);
    
    // 1. Extract claims (simple sentence split)
    const claims = response_text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // 2. Detect numbers and flag for verification
    const numericMatches = [...response_text.matchAll(/(\d+\.?\d*)\s*([a-zA-Z]+)?/g)];
    const numeric_flags = numericMatches.map(m => ({
      value: m[1],
      unit: m[2] || '',
      context: response_text.substring(
        Math.max(0, m.index! - 20),
        Math.min(response_text.length, m.index! + m[0].length + 40)
      )
    }));
    
    // 3. Calculate claim coverage - check if claims are supported by top chunks
    const topChunksForCoverage = chunks?.slice(0, 3) || [];
    let supportedClaims = 0;
    
    for (const claim of claims) {
      const claimWords = claim.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      
      for (const chunk of topChunksForCoverage) {
        const chunkText = (chunk.content || '').toLowerCase();
        const matchedWords = claimWords.filter((w: string) => chunkText.includes(w));
        
        // If 30%+ of claim words found in chunk, consider claim supported
        if (claimWords.length > 0 && matchedWords.length / claimWords.length > 0.3) {
          supportedClaims++;
          break;
        }
      }
    }
    
    const claim_coverage = claims.length > 0 ? supportedClaims / claims.length : 1.0;
    
    // 4. Calculate quality score - composite metric per spec
    const vectorMean = chunks && chunks.length > 0 
      ? chunks.slice(0, 3).reduce((sum: number, c: any) => sum + (c.score || 0), 0) / Math.min(3, chunks.length)
      : 0;
    const rerankMean = chunks && chunks.length > 0
      ? chunks.slice(0, 3).reduce((sum: number, c: any) => sum + (c.rerank_score || 0), 0) / Math.min(3, chunks.length)
      : 0;
    
    const coverageWeight = 0.5;
    const retrievalWeight = 0.3;
    const penaltyWeight = 0.2;
    
    const retrievalScore = (vectorMean * 0.4 + rerankMean * 0.6);
    const numericPenalty = numeric_flags.length > 0 ? 0.3 : 0.0;
    
    const quality_score = (
      claim_coverage * coverageWeight +
      retrievalScore * retrievalWeight -
      numericPenalty * penaltyWeight
    );
    
    // 5. Determine quality tier per spec
    let quality_tier = 'low';
    if (claim_coverage >= 0.8 && numeric_flags.length === 0) {
      quality_tier = 'high';
    } else if (claim_coverage >= 0.5) {
      quality_tier = 'medium';
    }
    
    console.log('📊 Quality Assessment:', {
      tier: quality_tier,
      score: quality_score.toFixed(3),
      coverage: claim_coverage.toFixed(2),
      claims_total: claims.length,
      claims_supported: supportedClaims,
      numeric_flags: numeric_flags.length,
      vector_mean: vectorMean.toFixed(3),
      rerank_mean: rerankMean.toFixed(3)
    });
    // ============ END QUALITY CHECKS ============

    // Log the query with quality metrics
    let queryLogId = null;
    try {
      const { data: logData, error: logError } = await supabase
        .from('query_logs')
        .insert({
          query_text: query,
          normalized_query: normalizeQuery(query),
          model_name: model,
          retrieval_method: strategy,
          response_text,
          manual_id: manual_id || null,
          top_doc_ids: chunks?.slice(0, 10).map(c => c.id) || [],
          top_doc_pages: chunks?.slice(0, 10).map(c => c.page_start || 0) || [],
          top_doc_scores: chunks?.slice(0, 10).map(c => c.rerank_score || 0) || [],
          // Training system fields
          numeric_flags: JSON.stringify(numeric_flags),
          claim_coverage,
          quality_score,
          quality_tier,
        })
        .select('id')
        .single();

      if (logError) {
        console.warn('⚠️ Failed to log query:', logError);
      } else {
        queryLogId = logData?.id;
        console.log('✅ Query logged with ID:', queryLogId);
      }
    } catch (e) {
      console.warn('⚠️ Query logging error:', e);
    }

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
        query_log_id: queryLogId,
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
