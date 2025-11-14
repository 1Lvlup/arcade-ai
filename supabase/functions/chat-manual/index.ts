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

// Answer Style V2 is always enabled - uses adaptive prompts from answerStyle.ts

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
  // Only trigger rundown for high-level overview questions, not specific "what is X" questions
  return /(overview|rundown|architecture|system\s+components|how\s+does\s+(the\s+)?(system|machine)\s+work)/i.test(s) ? "rundown" : "default";
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
        top_k: 75,
      },
    });

    if (searchResponse.error) {
      console.error("❌ Unified search error:", searchResponse.error);
      // Fallback to direct vector search
      const fallbackResults = await fallbackVectorSearch(hybridQuery, manual_id, tenant_id);
      console.log(`⏱️ Fallback search completed in ${Date.now() - startTime}ms`);
      return { textResults: fallbackResults, figureResults: [], strategy: "fallback_vector" };
    }

    const { textResults = [], figureResults = [], allResults = [] } = searchResponse.data || {};
    console.log(`✅ Unified search returned ${textResults.length} text, ${figureResults.length} figures in ${Date.now() - startTime}ms`);

    // 🔥 LAYER 4: Log search results with cross-manual detection
    const totalResults = textResults.length + figureResults.length;
    if (manual_id && totalResults > 0) {
      const wrongManual = [...textResults, ...figureResults].filter(
        r => r.manual_id && r.manual_id !== manual_id
      );
      if (wrongManual.length > 0) {
        console.error(`🚨 CROSS-MANUAL LEAK: ${wrongManual.length}/${totalResults} results from wrong manual!`);
        console.error(`   Requested: ${manual_id}`);
        console.error(`   Leaked:`, wrongManual.map(r => `${r.manual_id} (p${r.page_start})`).join(', '));
      } else {
        console.log(`✅ SEARCH CLEAN: All ${totalResults} results from manual_id="${manual_id}"`);
      }
    }

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

    return { 
      textResults: textResults.map(normalizeRow),
      figureResults: figureResults.map(normalizeRow),
      strategy: "unified_vector_rerank" 
    };
  } catch (error) {
    console.error("❌ Search error:", error);
    const fallbackResults = await fallbackVectorSearch(hybridQuery, manual_id, tenant_id);
    console.log(`⏱️ Error fallback completed in ${Date.now() - startTime}ms`);
    return { textResults: fallbackResults, figureResults: [], strategy: "error_fallback" };
  }
}

// Fallback to direct vector search if unified endpoint fails
async function fallbackVectorSearch(query: string, manual_id?: string, tenant_id?: string) {
  console.log("⚠️ Using fallback vector search");
  
  const queryEmbedding = await createEmbedding(query);
  
  const { data: vectorResults, error: vectorError } = await supabase.rpc("match_chunks_improved", {
    query_embedding: queryEmbedding,
    top_k: 75,
    min_score: 0.25,
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
    images?: string[];
  }
): Promise<string | ReadableStream> {
  let systemPrompt: string;
  let userPrompt: string;

  // Enhance system prompt when images are present
  if (opts?.images && opts.images.length > 0) {
    console.log(`🖼️ Processing ${opts.images.length} image(s) for vision analysis`);
  }

  // Use Answer Style V2 - adaptive prompts based on retrieval quality
  console.log(`✅ [Answer Style V2] Adaptive prompt system enabled`);
  
  // Compute signals if not provided
  const signals = opts?.signals ?? computeSignals(chunks.map(c => ({ score: c.rerank_score ?? c.score ?? 0 })));
  
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
    existingWeak: opts?.existingWeak ?? false,
    topScore: signals.topScore,
    avgTop3: signals.avgTop3,
    strongHits: signals.strongHits
  });

  systemPrompt = shaped.system;
  
  // Add vision-specific instructions when images are present
  if (opts?.images && opts.images.length > 0) {
    systemPrompt += `\n\nIMPORTANT: The user has provided ${opts.images.length} image(s) showing their arcade game issue. Analyze these images carefully for:
- Component identification (circuit boards, connectors, parts)
- Visible damage (burns, corrosion, broken components)
- Error codes or displays shown
- Wiring issues or loose connections
- Physical condition of parts

Reference specific observations from the images in your response and provide detailed analysis based on what you see.`;
  }
  
  userPrompt = shaped.user;

  console.log(`📊 [Answer Style V2] Weak: ${shaped.isWeak}, Top: ${signals.topScore.toFixed(3)}, Avg3: ${signals.avgTop3.toFixed(3)}, Strong: ${signals.strongHits}`);
  
  console.log(`🤖 Generating answer with model: ${model}`);

  const shouldStream = opts?.stream !== false; // Default to streaming

  // Always use Responses API - supports both streaming and non-streaming
  const url = "https://api.openai.com/v1/responses";

  // Build messages array with vision support
  const baseMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...(opts?.conversationHistory || []),
  ];
  
  // Add user message with images if present
  if (opts?.images && opts.images.length > 0) {
    baseMessages.push({
      role: "user",
      content: [
        { type: "text", text: userPrompt },
        ...opts.images.map(url => ({
          type: "image_url",
          image_url: { url, detail: "high" }
        }))
      ]
    });
  } else {
    baseMessages.push({ role: "user", content: userPrompt });
  }

  const messages = baseMessages;

  // Responses API uses 'input' and 'max_output_tokens' for all models
  const body: any = {
    model,
    input: messages,
    max_output_tokens: isGpt5(model) ? 8000 : 2000,
    stream: shouldStream,
    store: true // Enable caching for 40-80% cost reduction
  };

  // Add reasoning for GPT-5 models to enhance problem-solving
  if (isGpt5(model)) {
    body.reasoning = { effort: 'medium' };
  }

  console.log(`📤 [Responses API] Calling ${url} with model ${model}, stream: ${shouldStream}`);

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

  // Non-streaming: Responses API returns JSON with 'output' field
  if (!shouldStream) {
    console.log(`📦 Processing non-streaming response from Responses API`);
    try {
      const data = await response.json();
      console.log(`📦 Received JSON response:`, JSON.stringify(data).slice(0, 200));
      
      let fullText = '';
      
      // Handle different response formats
      if (Array.isArray(data.output)) {
        // New format with reasoning_effort: output is an array of objects
        const messageOutput = data.output.find((item: any) => item.type === 'message');
        if (messageOutput && Array.isArray(messageOutput.content)) {
          const textContent = messageOutput.content.find((item: any) => item.type === 'output_text');
          fullText = textContent?.text || '';
        }
      } else if (data.output?.content) {
        // Old format: output.content directly
        fullText = data.output.content;
      }
      
      console.log(`✅ Non-streaming response: ${fullText.length} characters`);
      if (!fullText) {
        console.error(`❌ Empty content! Response structure:`, JSON.stringify(data, null, 2));
      }
      return fullText;
    } catch (error) {
      console.error(`❌ Error parsing non-streaming response:`, error);
      throw error;
    }
  }

  // Streaming: Transform Responses API stream to Chat Completions API format
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
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue;
            
            if (line.startsWith('event:')) {
              continue;
            }
            
            if (line.startsWith('data: ')) {
              const dataContent = line.slice(6);
              
              if (dataContent === '[DONE]') {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                continue;
              }
              
              try {
                const parsed = JSON.parse(dataContent);
                
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
// STAGE 2: Interactive Elements Analyzer (Cheap Model)
// ─────────────────────────────────────────────────────────────────────────
async function analyzeForInteractiveElements(
  answerText: string,
  originalQuestion: string,
  context: { isWeak: boolean; hasFigures: boolean }
): Promise<{ interactive_components: any[] }> {
  
  const systemPrompt = `You are an interactive component selector for a troubleshooting chatbot.

Given a troubleshooting answer, determine which interactive UI elements would enhance the user experience.

Available components:
- button_group: For multiple choice actions (e.g., "Did this help?" with Yes/No buttons)
- checklist: For step-by-step procedures
- button: For single actions (e.g., "Show wiring diagram")
- input: For collecting user input (measurements, part numbers, etc.)
- select: For dropdown choices
- form: For multi-field data collection
- progress: For multi-step processes
- status: For success/warning/error states
- code: For technical values or settings
- slider: For adjustable values

Return JSON with this exact structure:
{
  "interactive_components": [
    {
      "type": "button_group",
      "props": {
        "label": "Did this help?",
        "buttons": [
          { "label": "Yes", "value": "yes", "variant": "default" },
          { "label": "No", "value": "no", "variant": "outline" }
        ]
      }
    },
    {
      "type": "checklist",
      "props": {
        "items": [
          { "label": "Step 1: Check power", "checked": false },
          { "label": "Step 2: Test voltage", "checked": false }
        ]
      }
    }
  ]
}

Rules:
- Only add components that genuinely enhance the answer
- Don't add components just for the sake of it
- Maximum 2-3 components per answer
- If no components would help, return empty array
- For multi-step procedures, always use checklist
- For feedback questions, use button_group
- Keep labels concise and actionable`;

  const userPrompt = `Original Question: ${originalQuestion}

Answer Generated:
${answerText}

Context:
- Retrieval quality: ${context.isWeak ? 'weak' : 'strong'}
- Contains figures: ${context.hasFigures}

Analyze this answer and determine which interactive components would enhance it.`;

  try {
    // Use Responses API with gpt-5-mini-2025-08-07 for structured output
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        ...(openaiProjectId && { 'OpenAI-Project': openaiProjectId }),
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        max_output_tokens: 1000,
        stream: false,
        store: true,
        reasoning: { effort: 'medium' }
      })
    });

    if (!response.ok) {
      console.error('❌ Interactive elements analysis failed:', response.statusText);
      return { interactive_components: [] };
    }

    const data = await response.json();
    
    // Handle different response formats
    let contentText = '';
    if (Array.isArray(data.output)) {
      // New format with reasoning: output is an array of objects
      const messageOutput = data.output.find((item: any) => item.type === 'message');
      if (messageOutput && Array.isArray(messageOutput.content)) {
        const textContent = messageOutput.content.find((item: any) => item.type === 'output_text');
        contentText = textContent?.text || '';
      }
    } else if (data.output?.content) {
      // Old format: output.content directly
      contentText = data.output.content;
    }
    
    if (!contentText) {
      console.error('❌ Empty content from interactive elements analysis');
      return { interactive_components: [] };
    }
    
    const result = JSON.parse(contentText);
    
    console.log(`✅ Generated ${result.interactive_components?.length || 0} interactive components`);
    return result;
  } catch (error) {
    console.error('❌ Error in analyzeForInteractiveElements:', error);
    return { interactive_components: [] };
  }
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
  conversationHistory?: Array<{ role: string; content: string }>,
  images?: string[]
) {
  console.log("\n🚀 [RAG V3] Starting simplified pipeline...\n");

  const { textResults, figureResults, strategy } = await searchChunks(query, manual_id, tenant_id);
  
  // 🖼️ Include figure results in the context so AI knows about diagrams/images
  const figureChunks = (figureResults || []).map(f => ({
    ...f,
    content: `[FIGURE p${f.page_start}] ${f.caption_text || ''}\n${f.ocr_text || ''}`.trim(),
    is_figure: true
  }));
  
  const chunks = [...textResults, ...figureChunks]; // Combine text and figure context
  console.log(`📊 Retrieved ${textResults.length} text chunks, ${figureResults.length} figures (strategy: ${strategy})`);

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

  console.log(`🎯 STAGE 1: Generating answer content with ${model || CHAT_MODEL}`);
  const retrievalWeak = weak || topChunks.length < 2;
  
  // Compute signals for Answer Style V2
  const signals = computeSignals(chunks.map(c => ({ score: c.rerank_score ?? c.score ?? 0 })));
  
  const answer = await generateAnswer(query, topChunks, model || CHAT_MODEL, { 
    retrievalWeak,
    signals,
    existingWeak: weak,
    stream: false, // Must be false for two-stage approach
    conversationHistory,
    images
  });

  // STAGE 2: Analyze answer and add interactive elements with cheap model
  console.log(`🎨 STAGE 2: Analyzing for interactive elements with gpt-4o-mini`);
  const elementsResult = await analyzeForInteractiveElements(
    answer as string, // Type assertion since stream is false
    query,
    {
      isWeak: weak,
      hasFigures: (figureResults?.length ?? 0) > 0
    }
  );

  console.log(`✅ [RAG V3] Pipeline complete - added ${elementsResult.interactive_components.length} interactive components\n`);

  return {
    answer,
    interactive_components: elementsResult.interactive_components,
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
    figureResults, // Pass figures separately
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
    // Import Zod for validation
    const { z } = await import('https://deno.land/x/zod@v3.22.4/mod.ts');
    
    // Define validation schema
    const chatRequestSchema = z.object({
      query: z.string().min(1, "Query cannot be empty").max(5000, "Query too long (max 5000 chars)"),
      manual_id: z.string().nullish(), // Accepts string | null | undefined
      stream: z.boolean().optional(),
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(10000, "Message content too long")
      })).max(50, "Too many messages (max 50)").optional(),
      images: z.array(z.string().url()).max(4, "Maximum 4 images allowed").optional()
    });
    
    // Parse and validate request body
    const rawBody = await req.json();
    const validatedBody = chatRequestSchema.parse(rawBody);
    const { query, manual_id, stream, messages, images } = validatedBody;

    console.log("\n=================================");
    console.log("🔍 NEW CHAT REQUEST");
    console.log("Query:", query);
    console.log("Manual ID:", manual_id || "All manuals");
    console.log("Stream:", stream || false);
    console.log("=================================\n");

    // Check for Rundown Mode (DISABLED - always use default mode)
    const mode = "default"; // pickModeFromQuery(query);
    console.log("Mode:", mode);

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

    // Extract tenant from auth header and handle rate limiting
    const authHeader = req.headers.get("authorization");
    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0] || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    
    let tenant_id: string | undefined;
    let usageInfo: any = null;

    if (authHeader) {
      // Authenticated user flow
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

    // Auto-detect manual from query if not specified
    let effectiveManualId = manual_id;
    let detectedManualTitle = null;
    
    if (!effectiveManualId) {
      try {
        console.log("🔍 No manual_id provided, attempting auto-detection...");
        const detectionResponse = await supabase.functions.invoke('detect-manual', {
          body: { query, tenant_id }
        });

        if (!detectionResponse.error && detectionResponse.data) {
          const { manual_id: detected_id, manual_title, confidence, reasoning } = detectionResponse.data;
          
          if (detected_id && (confidence === "high" || confidence === "medium")) {
            effectiveManualId = detected_id;
            detectedManualTitle = manual_title;
            console.log(`✅ Auto-detected manual: ${manual_title} (confidence: ${confidence})`);
            console.log(`   Reasoning: ${reasoning}`);
          } else if (detected_id && confidence === "low") {
            console.log(`⚠️ Manual detected with low confidence, searching all manuals instead`);
            console.log(`   Detected: ${manual_title}, Reasoning: ${reasoning}`);
          } else {
            console.log(`ℹ️ No specific manual detected, searching all manuals`);
          }
        }
      } catch (detectionError) {
        console.warn("⚠️ Manual detection failed, proceeding without filter:", detectionError);
      }
    }

    // Run pipeline
    console.log("🚀 Using RAG Pipeline V3\n");
    console.log(`📊 QUERY LOG: manual_requested="${manual_id || 'null'}", manual_effective="${effectiveManualId || 'null'}", tenant="${tenant_id || 'null'}"`);
    
    // If streaming is requested, handle it differently
    if (stream) {
      console.log("📡 Starting streaming response");
      const ragResult = await runRagPipelineV3(query, effectiveManualId, tenant_id, model, messages, images);
      const { sources, strategy, chunks, figureResults } = ragResult;
      
      // Log the query to get query_log_id for feedback
      let queryLogId = null;
      try {
        const { data: logData, error: logError } = await supabase
          .from('query_logs')
          .insert({
            query_text: query,
            manual_id: effectiveManualId || null,
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
      
      // Compute signals for streaming response (required for Answer Style V2)
      const streamSignals = computeSignals((chunks || []).map(c => ({ score: c.rerank_score ?? c.score ?? 0 })));
      console.log(`📊 [Streaming] Computed signals - Top: ${streamSignals.topScore.toFixed(3)}, Avg3: ${streamSignals.avgTop3.toFixed(3)}, Strong: ${streamSignals.strongHits}`);
      
      // Get the answer stream with conversation history
      const answerStream = await generateAnswer(query, chunks || [], model, {
        retrievalWeak: false,
        signals: streamSignals, // Pass signals for Answer Style V2
        stream: true,
        conversationHistory: messages
      }) as ReadableStream;
      
      // Create a new stream that sends metadata first, then the answer
      const streamWithMetadata = new ReadableStream({
        async start(controller) {
          // PHASE 2.1: Enhanced logging and contamination detection
          const chunkIds = (chunks || []).map(c => c.id).filter(Boolean);
          let thumbnails: any[] = [];
          
          // Auto-detect manual_id from chunks if not provided
          let effectiveManualId = manual_id;
          if (!effectiveManualId && chunks && chunks.length > 0) {
            const firstManualId = chunks[0]?.manual_id;
            if (firstManualId) {
              effectiveManualId = firstManualId;
              console.log(`🔍 Auto-detected manual_id from chunks: ${effectiveManualId}`);
            }
          }
          
          // Pre-validation: check for cross-manual contamination
          if (effectiveManualId && chunks && chunks.length > 0) {
            const chunksByManual = new Map<string, number>();
            for (const chunk of chunks) {
              const mid = chunk.manual_id || 'unknown';
              chunksByManual.set(mid, (chunksByManual.get(mid) || 0) + 1);
            }
            
            // Check if chunks span multiple manuals
            if (chunksByManual.size > 1) {
              const manualBreakdown = Array.from(chunksByManual.entries())
                .map(([mid, count]) => `${mid}(${count})`)
                .join(', ');
              const wrongManualChunks = chunks.filter(c => c.manual_id !== effectiveManualId);
              console.error(`❌ CROSS-MANUAL CONTAMINATION DETECTED!`);
              console.error(`   Expected: ${effectiveManualId} only`);
              console.error(`   Found: ${manualBreakdown}`);
              console.error(`   Wrong chunks: ${wrongManualChunks.length}/${chunks.length}`);
            } else {
              console.log(`✅ PRE-VALIDATION: All ${chunks.length} chunks from correct manual: ${effectiveManualId}`);
            }
          }
          
          if (chunkIds.length > 0 && effectiveManualId) {
            try {
              // Pass figure results from search to buildCitationsAndImages
              const figures = figureResults || [];
              const { thumbnails: imgs } = await buildCitationsAndImages(supabase, chunkIds, figures, effectiveManualId);
              thumbnails = imgs || [];
              console.log(`🖼️ Retrieved ${thumbnails.length} images for manual: ${effectiveManualId}`);
            } catch (e) {
              console.error('❌ Error fetching images:', e);
              // Don't fail the entire request, just log and continue without images
            }
          } else if (!effectiveManualId) {
            console.warn('⚠️ No manual_id detected, skipping image retrieval');
          }
          
          // Get manual title if manual_id is specified
          let manualTitle = null;
          if (effectiveManualId) {
            try {
              const { data: manualData } = await supabase
                .from('manual_metadata')
                .select('canonical_title')
                .eq('manual_id', effectiveManualId)
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
              manual_id: effectiveManualId || null,
              manual_title: manualTitle,
              auto_detected: detectedManualTitle ? true : false,
              detected_manual_title: detectedManualTitle
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
    
    const result = await runRagPipelineV3(query, effectiveManualId, tenant_id, model, messages, images);

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
          manual_id: effectiveManualId || null,
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
        usage: usageInfo ? {
          queries_used: usageInfo.queries_used,
          queries_remaining: usageInfo.queries_remaining,
          queries_limit: usageInfo.queries_limit || (usageInfo.manual_override ? null : 5),
          limit_reached: usageInfo.limit_reached,
          manual_override: usageInfo.manual_override || false,
          is_authenticated: !!tenant_id,
          signup_required: !tenant_id && usageInfo.limit_reached
        } : null
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
