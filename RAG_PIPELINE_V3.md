# RAG Pipeline V3 - Production System Documentation

**Status:** ✅ Production (Replaced V2 in full)  
**Version:** 3.0  
**Last Updated:** 2025-10-13

---

## Overview

RAG Pipeline V3 is a streamlined, single-stage retrieval-augmented generation system that combines hybrid search, quality-based routing, and adaptive prompt engineering to generate expert-level troubleshooting answers from technical manuals.

### Key Improvements Over V2

- **Single-stage generation** (removed Draft → Expert → Review stages)
- **Hybrid retrieval** (vector + text + keyword fallback)
- **Cohere reranking** for relevance optimization
- **Answer Style V2 integration** for adaptive prompting
- **Quality gates** with intelligent fallbacks
- **Per-tenant model configuration**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│  (ChatBot.tsx, SimpleChat.tsx)                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    chat-manual Edge Function                    │
│  • Extract tenant_id from JWT                                   │
│  • Load model config from ai_config table                       │
│  • Route to runRagPipelineV3()                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RAG Pipeline V3                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  STAGE 1: Hybrid Search (searchChunks)                   │  │
│  │  • Create query embedding (OpenAI)                        │  │
│  │  • Expand query with synonyms                             │  │
│  │  • Vector search: match_chunks_improved() (60 results)    │  │
│  │  • Spec/connector bias boost                              │  │
│  │  • Weak fallback: expandIfWeak() → retry search           │  │
│  │  • Cohere rerank (top 10)                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  STAGE 2: Quality Checks                                  │  │
│  │  • Compute retrieval signals (Answer Style V2)            │  │
│  │  • Check: maxRerankScore >= 0.45 OR maxBaseScore >= 0.35 │  │
│  │  • Check: Real pages (not just p1/TOC)                    │  │
│  │  • Check: Has spec tokens (connectors, voltages)          │  │
│  │  • Gate: Return clarifying questions if low quality       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  STAGE 3: Answer Generation                               │  │
│  │  • If ANSWER_STYLE_V2=1:                                  │  │
│  │    → computeSignals() from chunks                         │  │
│  │    → shapeMessages() adaptive prompts                     │  │
│  │  • Else:                                                   │  │
│  │    → Use static CONVERSATIONAL or STRUCTURED prompts      │  │
│  │  • Call OpenAI API (GPT-5 or configured model)            │  │
│  │  • Return answer with sources                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Request Entry
```typescript
POST /functions/v1/chat-manual
Body: { query: string, manual_id?: string }
Headers: { authorization: "Bearer <JWT>" }
```

### 2. Tenant & Model Resolution
- Extract `user_id` from JWT
- Lookup `fec_tenant_id` from `profiles` table
- Query `ai_config` table for tenant's model preference
- Default: `gpt-5-2025-08-07`

### 3. Hybrid Search Pipeline
```typescript
searchChunks(query, manual_id, tenant_id)
  ├── expandQuery() → Add synonyms (e.g., "ball gate" for "balls stuck")
  ├── createEmbedding() → OpenAI text-embedding-3-small
  ├── match_chunks_improved() → Postgres vector search (60 results, min_score: 0.3)
  ├── boostSpecCandidates() → Prioritize chunks with connectors/voltages
  ├── Weak fallback: expandIfWeak() → Retry with power/voltage synonyms
  └── Cohere rerank → Top 10 chunks (rerank-english-v3.0)
```

### 4. Quality Gates
```typescript
// Weak detection
maxRerankScore < 0.45 AND maxBaseScore < 0.35 AND chunks.length < 3
  → weak = true

// Page quality check
hasRealPages = pages.size >= 2 AND !pages.has(1)  // Not just cover/TOC
hasSpecTokens = chunks contain connectors/voltages

// Gate condition
IF (!hasRealPages AND !hasSpecTokens)
  → Return clarifying questions (no answer generated)
```

### 5. Answer Style V2 Integration
```typescript
// Compute retrieval quality signals
const signals = computeSignals(chunks)
  → { topScore, avgTop3, strongHits }

// Thresholds (configurable via secrets)
RETRIEVAL_MIN_TOP_SCORE = 0.62
RETRIEVAL_WEAK_AVG = 0.58
RETRIEVAL_MIN_STRONG = 2

// Adaptive prompt selection
shapeMessages(query, chunks, signals)
  ├── If weak → Add: "Retrieval is WEAK. Be candid about limits..."
  └── If strong → Add: "Retrieval is STRONG. Prefer doc-backed steps..."
```

### 6. Model Call
```typescript
// GPT-5 (new API)
POST https://api.openai.com/v1/responses
{
  model: "gpt-5-2025-08-07",
  input: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  max_output_tokens: 8000
}

// GPT-4 / Others (old API)
POST https://api.openai.com/v1/chat/completions
{
  model: "gpt-4.1-2025-04-14",
  messages: [...],
  max_tokens: 2000,
  temperature: 0.4  // conversational mode
}
```

### 7. Response Format
```typescript
{
  answer: string,
  sources: Array<{
    manual_id: string,
    content: string,  // truncated to 200 chars
    page_start: number,
    page_end: number,
    menu_path: string,
    score: number,
    rerank_score: number
  }>,
  strategy: "vector" | "text" | "simple" | "none",
  metadata: {
    pipeline_version: "v3",
    manual_id: string,
    embedding_model: "text-embedding-3-small",
    retrieval_strategy: string,
    candidate_count: number,
    rerank_scores: number[]
  },
  context_seen: string  // Full chunk content for debugging
}
```

---

## Configuration

### Environment Variables (Supabase Secrets)

| Secret | Default | Description |
|--------|---------|-------------|
| `ANSWER_STYLE_V2` | `"0"` | Enable adaptive prompting (`"1"` = enabled) |
| `ANSWER_STYLE` | `"conversational"` | Fallback prompt style (`"conversational"` \| `"structured"`) |
| `CHAT_MODEL` | `"gpt-5-2025-08-07"` | Default model (overridable per-tenant) |
| `RETRIEVAL_MIN_TOP_SCORE` | `0.62` | Min top chunk score for "strong" retrieval |
| `RETRIEVAL_WEAK_AVG` | `0.58` | Min avg of top 3 chunks for "strong" |
| `RETRIEVAL_MIN_STRONG` | `2` | Min count of chunks above threshold |
| `OPENAI_API_KEY` | *(required)* | OpenAI API key |
| `OPENAI_PROJECT_ID` | *(optional)* | OpenAI project ID |
| `COHERE_API_KEY` | *(required)* | Cohere API key for reranking |
| `ENABLE_RUNDOWN` | `"false"` | Enable rundown mode for overview queries |

### Per-Tenant Model Override
```sql
-- ai_config table
INSERT INTO ai_config (fec_tenant_id, config_key, config_value)
VALUES ('tenant-uuid', 'chat_model', '"claude-sonnet-4-5"');

-- Supported models
"gpt-5-2025-08-07"
"gpt-5-mini-2025-08-07"
"gpt-5-nano-2025-08-07"
"gpt-4.1-2025-04-14"
"claude-sonnet-4-5"
```

---

## Prompt Systems

### Answer Style V2 (Adaptive - RECOMMENDED)

**System Prompt:**
```
You are GPT-5 Thinking, a senior arcade/FEC technician. Be human, concise, and evidence-first.
Label inference as "Working theory" when docs are thin. Give 1–3 actionable checks.
Include inline doc mentions when applicable (e.g., "HB Motor Board v3.2, p.14").
Start with a short bottom line, then steps, then a tiny "Why this".

[STRONG MODE]
Retrieval is STRONG. Prefer doc-backed steps and name the doc/section inline.

[WEAK MODE]
Retrieval is WEAK. Be candid about limits; switch to best-practice checks; 
mark inferences as "Working theory."
```

**Signals Computed:**
- `topScore`: Highest rerank score from retrieved chunks
- `avgTop3`: Average of top 3 chunk scores
- `strongHits`: Count of chunks >= `RETRIEVAL_MIN_TOP_SCORE`

**Mode Selection:**
```
isWeak = topScore < 0.62 OR avgTop3 < 0.58 OR strongHits < 2
```

### Conversational (Static Fallback)

**System Prompt:**
```
You are "Dream Technician Assistant," a friendly, insanely competent arcade/bowling tech coach.
Talk like a trusted coworker: short, warm sentences; answer first, then a brief why, 
then 3–5 quick bullets. Weave citations inline like (Manual p. 12) when you use a source.

Rules:
- Never invent exact numbers, part numbers, pins, or connector IDs
- Prefer plain verbs ("unplug, reseat, measure")
- Mention power-off whenever measuring resistance
```

**Temperature:** 0.4

### Structured (Static Fallback)

**System Prompt:**
```
You are an expert arcade service assistant. Give actionable repair steps a field tech 
can follow safely on-site.

Rules:
1) Map the symptom to the likely subsystem by name
2) Output 2–4 decisive tests with numbers, pins, connectors
3) Each test must cite an exact page from context
4) Prefer procedures and wiring tables over parts lists
5) Stop when a fault is confirmed

Format:
**Subsystem:** <name>
**Do this first (2–4 steps):**
1) <Test> — p<X>
**Why:** <rationale>
**Citations:** p<X>, p<Y>
```

**Temperature:** 0.1

---

## Key Functions

### `searchChunks(query, manual_id?, tenant_id?)`
**Purpose:** Hybrid retrieval with reranking  
**Location:** `chat-manual/index.ts` lines 211-353

**Steps:**
1. `expandQuery()` - Add synonyms for common issues
2. `createEmbedding()` - OpenAI text-embedding-3-small
3. `match_chunks_improved()` - Postgres vector search (60 results)
4. `boostSpecCandidates()` - Prioritize chunks with J1/pin/voltage tokens
5. Weak fallback: `expandIfWeak()` → retry with power/voltage expansion
6. Cohere rerank → Top 10 chunks

**Returns:**
```typescript
{
  results: Array<{
    id: uuid,
    manual_id: string,
    content: string,
    page_start: number,
    page_end: number,
    menu_path: string,
    score: number,  // vector similarity
    rerank_score?: number  // Cohere relevance
  }>,
  strategy: "vector" | "text" | "simple" | "none"
}
```

### `runRagPipelineV3(query, manual_id?, tenant_id?, model?)`
**Purpose:** Main orchestration pipeline  
**Location:** `chat-manual/index.ts` lines 625-711

**Steps:**
1. Call `searchChunks()`
2. Quality checks (weak detection, page quality, spec tokens)
3. Gate: Return clarifying questions if low quality
4. Compute signals (Answer Style V2)
5. Call `generateAnswer()`
6. Return formatted response

### `generateAnswer(query, chunks, model, opts?)`
**Purpose:** Generate answer with adaptive or static prompts  
**Location:** `chat-manual/index.ts` lines 461-590

**Prompt Selection:**
```typescript
if (USE_ANSWER_STYLE_V2 && opts?.signals) {
  // Adaptive mode
  const shaped = shapeMessages(query, chunks, signals);
  systemPrompt = shaped.system;  // STRONG or WEAK mode
  userPrompt = shaped.user;
} else {
  // Static mode
  systemPrompt = ANSWER_STYLE === "conversational" 
    ? SYSTEM_PROMPT_CONVERSATIONAL 
    : SYSTEM_PROMPT_STRUCTURED;
}
```

### `computeSignals(hits)`
**Purpose:** Calculate retrieval quality metrics  
**Location:** `_shared/answerStyle.ts` lines 17-23

**Returns:**
```typescript
{
  topScore: number,      // Max score from all chunks
  avgTop3: number,       // Average of top 3 scores
  strongHits: number     // Count >= RETRIEVAL_MIN_TOP_SCORE
}
```

### `shapeMessages(question, contextSnippets, opts)`
**Purpose:** Build adaptive system/user prompts  
**Location:** `_shared/answerStyle.ts` lines 25-54

**Returns:**
```typescript
{
  system: string,   // Base prompt + STRONG/WEAK guidance
  user: string,     // Question + formatted snippets
  isWeak: boolean   // Final weak detection result
}
```

---

## Quality Gates & Fallbacks

### Gate 1: No Chunks Retrieved
```typescript
if (chunks.length === 0) {
  return buildFallbackFor(query);  // Generic troubleshooting steps
}
```

### Gate 2: Weak Retrieval
```typescript
const weak = chunks.length < 3 || (!hasGoodRerank && !hasGoodBase);

if (weak) {
  console.log("⚠️ Weak evidence — proceeding with model anyway");
  // No early return, but signals passed to Answer Style V2
}
```

### Gate 3: Low Page/Spec Quality
```typescript
const hasRealPages = pages.size >= 2 && !pages.has(1);
const hasSpecTokens = chunks.some(c => looksSpecy(c.content));

if (!hasRealPages && !hasSpecTokens) {
  // Return clarifying questions instead of answer
  return {
    answer: "No manual evidence found with exact specs/pages.\n\n" +
            "Follow-up: A) Which subsystem? B) Which lane? ...",
    sources: [],
    strategy,
    chunks: topChunks
  };
}
```

### Fallback Answers (buildFallbackFor)
**Location:** `chat-manual/index.ts` lines 595-620

**Patterns:**
- **Ball gate issues:** Specific ball gate troubleshooting steps
- **General issues:** Power/sensor/connector check sequence

---

## Database Functions

### `match_chunks_improved(query_embedding, top_k, min_score, manual, tenant_id)`
**Purpose:** Vector similarity search on `chunks_text` table

**SQL:**
```sql
SELECT 
  c.id, c.manual_id, c.content, c.page_start, c.page_end, c.menu_path,
  1 - (c.embedding <=> query_embedding) AS score,
  'text'::text as content_type
FROM chunks_text c
WHERE (manual IS NULL OR c.manual_id = manual)
  AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
  AND c.embedding IS NOT NULL
  AND (1 - (c.embedding <=> query_embedding)) >= min_score
ORDER BY c.embedding <=> query_embedding
LIMIT top_k
```

### `match_chunks_text(query_text, top_k, manual, tenant_id)`
**Purpose:** Full-text search fallback (phrase → OR → AND)

**Not currently used in V3** - Vector search is primary

### `simple_search(search_query, search_manual, search_tenant, search_limit)`
**Purpose:** Keyword search last resort

**Not currently used in V3** - Vector + rerank is sufficient

---

## External API Integrations

### OpenAI Embeddings
```typescript
POST https://api.openai.com/v1/embeddings
{
  model: "text-embedding-3-small",
  input: "expanded query text"
}
→ Returns: number[] (1536 dimensions)
```

### Cohere Rerank
```typescript
POST https://api.cohere.ai/v1/rerank
{
  model: "rerank-english-v3.0",
  query: "user query",
  documents: ["chunk 1", "chunk 2", ...],  // truncated to 1500 chars
  top_n: 10
}
→ Returns: { results: [{ index, relevance_score }] }
```

### OpenAI Chat Completions
**GPT-5 (new API):**
```typescript
POST https://api.openai.com/v1/responses
{
  model: "gpt-5-2025-08-07",
  input: [{ role, content }, ...],
  max_output_tokens: 8000
}
```

**GPT-4 / Others (old API):**
```typescript
POST https://api.openai.com/v1/chat/completions
{
  model: "gpt-4.1-2025-04-14",
  messages: [{ role, content }, ...],
  max_tokens: 2000,
  temperature: 0.4
}
```

---

## Logging & Debugging

### Key Log Messages
```
🚀 [RAG V3] Starting simplified pipeline...
🔍 Starting hybrid search: <query>
🔑 Keywords: <extracted keywords>
✅ Created query embedding
📊 Vector search found X results
🔄 Reranking with Cohere...
✅ Reranked to top X results
⏱️ Search completed in Xms
📊 Answerability check: { chunk_count, max_rerank, max_base, is_weak }
⚠️ Weak evidence detected — proceeding with model anyway
📊 [Answer Style V2] Weak: <bool>, Top: <score>, Avg3: <score>, Strong: <count>
🎯 STAGE 1: Generating answer with model: <model>
🤖 Generating answer with model: <model>
📤 Calling <url> with model <model>
📦 OpenAI response usage: <usage stats>
✅ Answer generated: <first 100 chars>...
✅ [RAG V3] Pipeline complete
```

### Edge Function Logs
Access via: https://supabase.com/dashboard/project/wryxbfnmecjffxolcgfa/functions/chat-manual/logs

**Look for:**
- Retrieval scores (rerank + base)
- Weak mode triggers
- Quality gate rejections
- API response times

### Network Requests
Check browser DevTools → Network tab for:
- Request payload: `{ query, manual_id }`
- Response: `{ answer, sources, strategy, metadata, context_seen }`
- Status codes (200 = success)

---

## Testing Scenarios

### 1. Strong Retrieval (Expected: Confident Answer)
```
Query: "What voltage should J14 pin 2 be on the I/O board?"
Expected Signals: topScore > 0.7, avgTop3 > 0.65, strongHits >= 3
Expected Mode: STRONG (doc-backed steps)
```

### 2. Weak Retrieval (Expected: Working Theory)
```
Query: "Why won't my machine turn on?"
Expected Signals: topScore < 0.5, avgTop3 < 0.4, strongHits < 2
Expected Mode: WEAK (best-practice guidance)
```

### 3. Quality Gate Trigger (Expected: Clarifying Questions)
```
Query: "opto problem"
Expected: !hasRealPages && !hasSpecTokens → Return follow-up questions
```

### 4. Synonym Expansion (Expected: Better Retrieval)
```
Query: "balls won't come out"
Expected: Expansion to "ball gate, ball release, gate motor, gate open sensor..."
```

### 5. Spec Bias (Expected: Prioritize Connector Docs)
```
Query: "J14 pinout"
Expected: boostSpecCandidates() → chunks with J14/pin/voltage first
```

---

## Migration from V2

### What Was Removed
- ❌ `generateDraftAnswer()` - 3-stage pipeline stage 1
- ❌ `generateExpertAnswer()` - 3-stage pipeline stage 2
- ❌ `reviewAnswer()` - 3-stage pipeline stage 3
- ❌ Separate draft/expert/review prompts
- ❌ JSON output parsing between stages
- ❌ Citation validation logic

### What Was Added
- ✅ `runRagPipelineV3()` - Single-stage orchestration
- ✅ `searchChunks()` - Unified hybrid retrieval
- ✅ Answer Style V2 integration
- ✅ Quality gates with clarifying questions
- ✅ Per-tenant model configuration
- ✅ Cohere reranking
- ✅ Weak fallback expansion

### Breaking Changes
- **None** - V3 is a drop-in replacement with identical API contract
- Same request/response format
- Same authentication flow
- Same database schema

---

## Performance Benchmarks

**Typical Response Times:**
- Embedding creation: 100-300ms
- Vector search: 50-150ms
- Cohere rerank: 200-400ms
- GPT-5 generation: 2-8s (streaming)
- **Total:** 3-10s end-to-end

**Token Usage (GPT-5):**
- Input: 1,500-3,000 tokens (10 chunks @ ~150 tokens each)
- Output: 300-800 tokens (typical answer)
- Cost: ~$0.02-0.05 per request (at GPT-5 pricing)

---

## Troubleshooting

### Issue: Empty/Generic Answers
**Symptoms:** Answer doesn't reference manual pages  
**Cause:** Quality gate triggered or weak retrieval  
**Fix:**
1. Check logs for "No manual evidence found"
2. Verify chunks have real page numbers (not all p1)
3. Check rerank scores > 0.01
4. Add more specific keywords to query

### Issue: Answer Style V2 Not Activating
**Symptoms:** No "📊 [Answer Style V2]" log  
**Cause:** `ANSWER_STYLE_V2` secret not set to "1"  
**Fix:**
```bash
# In Supabase dashboard → Project Settings → Edge Functions → Secrets
ANSWER_STYLE_V2=1
```

### Issue: Wrong Model Being Used
**Symptoms:** Logs show unexpected model  
**Cause:** Per-tenant override in `ai_config` table  
**Fix:**
```sql
-- Check current config
SELECT * FROM ai_config WHERE config_key = 'chat_model';

-- Update or delete override
UPDATE ai_config 
SET config_value = '"gpt-5-2025-08-07"'
WHERE config_key = 'chat_model';
```

### Issue: Cohere Rerank Failing
**Symptoms:** "⚠️ COHERE_API_KEY not found, skipping rerank"  
**Cause:** Missing or invalid Cohere API key  
**Fix:**
1. Add `COHERE_API_KEY` secret in Supabase
2. Verify key is active on Cohere dashboard

### Issue: GPT-5 API Errors
**Symptoms:** "Model returned an empty response" or 400 errors  
**Cause:** Invalid API parameters for GPT-5  
**Fix:**
- Ensure using `/v1/responses` endpoint (not `/v1/chat/completions`)
- Remove `temperature` parameter (not supported)
- Use `max_output_tokens` (not `max_tokens`)

---

## Future Improvements

### Short-term
- [ ] Add vector caching for repeated queries
- [ ] Implement query rewriting for ambiguous questions
- [ ] Add figure/image retrieval to chunks
- [ ] Create admin dashboard for tuning thresholds

### Medium-term
- [ ] Multi-manual aggregation (cross-reference answers)
- [ ] User feedback loop (thumbs up/down on answers)
- [ ] A/B testing framework for prompt variants
- [ ] Streaming responses (SSE) for better UX

### Long-term
- [ ] Fine-tuned model on arcade repair data
- [ ] Automatic synonym expansion learning
- [ ] Citation verification with OCR cross-check
- [ ] Multi-modal retrieval (diagrams + text)

---

## Support & Contact

**Documentation:**
- This file: `RAG_PIPELINE_V3.md`
- Answer Style V2: `ANSWER_STYLE_V2_README.md`
- Code: `supabase/functions/chat-manual/index.ts`
- Shared utils: `supabase/functions/_shared/answerStyle.ts`

**Edge Function Logs:**
- https://supabase.com/dashboard/project/wryxbfnmecjffxolcgfa/functions/chat-manual/logs

**Related Database Functions:**
- `match_chunks_improved` - Vector search
- `match_chunks_text` - Text search (unused in V3)
- `simple_search` - Keyword search (unused in V3)

**Related Tables:**
- `chunks_text` - Text chunks with embeddings
- `ai_config` - Per-tenant configuration
- `profiles` - User → tenant mapping

---

## Changelog

### v3.0.0 (2025-10-13)
- ✅ Complete rewrite from V2 3-stage pipeline
- ✅ Added Answer Style V2 integration
- ✅ Added Cohere reranking
- ✅ Added quality gates with clarifying questions
- ✅ Added per-tenant model configuration
- ✅ Removed precision guard (overly strict)
- ✅ Simplified to single-stage generation
- ✅ Added comprehensive logging

### v2.x (Legacy - REMOVED)
- Draft → Expert → Review stages
- JSON output parsing
- Citation validation
- Multiple model calls per query
