# System Prompts Documentation

This document contains all AI prompts used across the system for transparency and easy modification.

## Table of Contents
1. [Chat Manual - Main Answer Generation](#chat-manual---main-answer-generation)
2. [Manual Detection](#manual-detection)
3. [Clarification Questions](#clarification-questions)
4. [Answer Style V2](#answer-style-v2)
5. [Search & Retrieval](#search--retrieval)

---

## Chat Manual - Main Answer Generation

### Location
`supabase/functions/chat-manual/index.ts` (lines 377-426)

### Conversational System Prompt
```
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
- Never invent specs, part numbers, or connector IDs - if missing say "spec not captured"
- Mention power-off for any resistance checks or moving parts
- Use plain action verbs: "unplug, reseat, measure, check"
- When suggesting checks, include what readings/results to expect

LEADING QUESTIONS FORMAT (always include at end):
"What to check next:"
• [Question about related system/component]?
• [Question about symptom progression or related issue]?
• [Question to narrow down root cause]?

Keep it conversational and helpful - you're saving them a second trip!
```

**Purpose**: Primary system prompt for generating conversational, helpful answers to technical questions about arcade/bowling machines.

**Key Features**:
- 5-part answer structure (answer → why → steps → considerations → next steps)
- Inline citations required (Manual p. X)
- Never fabricate technical specs
- Always includes leading questions to help user troubleshoot further
- Conversational, coworker tone

---

### Structured System Prompt
```
You are an expert arcade service assistant. Give **actionable** repair steps a field tech can follow safely on-site.

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

**Citations:** p<X>, p<Y>, p<Z>
```

**Purpose**: Alternative structured format for technical troubleshooting.

**Key Features**:
- Focuses on actionable tests with specific measurements
- Requires exact page citations for every step
- Prioritizes technical specifications (voltages, pins, connectors)
- Stops at fault confirmation, no speculation
- Includes diagnostic mode entry instructions

---

### User Prompt Template (Conversational/Structured)
```
Question: {query}

Manual content:
{contextBlocks}

Provide a clear answer using the manual content above.
```

Optional additions:
- **Style request**: If user asks for simplified explanation (e.g., "explain like a 5th grader")
- **Retrieval note**: If search results are weak: "(Notes for the assistant: Retrieval was thin. Still answer decisively using "field-tested play". Be clear when specs are missing with "spec not captured". Keep tone confident and helpful.)"

---

## Manual Detection

### Location
`supabase/functions/detect-manual/index.ts` (lines 70-89)

### Detection Prompt
```
You are a manual detection assistant. Given a user query about arcade machines, identify which manual they are asking about.

Available manuals:
{manualsList}

User query: "{query}"

Analyze the query and determine:
1. Is the user asking about a specific manual/machine? 
2. If yes, which manual best matches their question?
3. Consider variations in naming (abbreviations, partial names, common nicknames, misspellings)

Respond with a JSON object:
{
  "manual_id": "the-manual-id" or null if no specific manual detected,
  "confidence": "high" | "medium" | "low" | "none",
  "reasoning": "brief explanation of your decision"
}

Only set manual_id if you're confident the user is asking about a specific manual. If the query is general or could apply to multiple manuals, return null.
```

**Purpose**: Auto-detect which manual the user is asking about from their query.

**Model**: `claude-sonnet-4-5` (via Lovable AI Gateway)

**Key Features**:
- Handles abbreviations, misspellings, partial names
- Returns confidence level (high/medium/low/none)
- Provides reasoning for transparency
- Only triggers for medium+ confidence

**Example Manual List Format**:
```
- "Down the Clown" (also known as: DTC, Down Clown) [ICE Arcade] -> ID: down-the-clown
- "Big Bass Wheel" [ICE Bowling] -> ID: big-bass-wheel
```

---

## Clarification Questions

### Location
`supabase/functions/chat-manual/index.ts` (lines 712-721)

### Clarification Prompt
```
You are a helpful arcade technician assistant. A user asked: "{query}"

You don't have specific manual documentation for this exact query. Instead of giving up, ask a friendly clarifying question to help narrow down what they need.

Be conversational and helpful. For example:
- If they ask about a sensor, ask which specific sensor or which part of the machine
- If they ask about power, ask what component or where they're measuring
- If they're asking about a part location, ask them to describe what they're looking at

Keep it short (2-3 sentences max) and friendly.
```

**Purpose**: Generate helpful clarifying questions when search results are insufficient.

**Model**: `gpt-4.1-mini`

**Triggers when**:
- Less than 2 unique pages found
- No technical specifications found
- No chunks with substantial content (>100 chars)

**Example outputs**:
- "Could you tell me which specific sensor you're working with? There are several on the machine."
- "Are you measuring power at the main board or a specific component?"

---

## Answer Style V2

### Location
`supabase/functions/_shared/answerStyle.ts`

Answer Style V2 is an adaptive system prompt that changes based on retrieval quality signals.

### Signals Used
```typescript
{
  topScore: number,      // Best matching chunk score (0-1)
  avgTop3: number,       // Average score of top 3 chunks
  strongHits: number     // Count of chunks with score > 0.85
}
```

### Adaptive Behavior

**When retrieval is STRONG** (topScore > 0.85, avgTop3 > 0.75):
```
You have highly relevant manual content. Answer with complete confidence.
- Cite pages precisely
- Provide detailed step-by-step instructions
- Include specific part numbers, voltages, connector names
```

**When retrieval is WEAK** (topScore < 0.65):
```
The manual content is partially relevant. Be honest about gaps.
- Answer what you can from available context
- Clearly mark gaps: "The manual doesn't specify..."
- Suggest what information would help narrow it down
```

**When retrieval is MODERATE**:
```
You have decent manual coverage. Answer confidently but acknowledge limitations.
- Use available specifications
- Note if certain details aren't in the provided content
```

This ensures the AI doesn't fabricate information when retrieval is weak.

---

## Search & Retrieval

### Visual Query Detection

**Location**: `supabase/functions/search-unified/index.ts` (line 37-40)

```typescript
function isVisualQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return /\b(diagram|show|illustration|schematic|drawing|image|picture|figure)\b/.test(lowerQuery);
}
```

**Purpose**: Detect when user is asking for visual content (diagrams, schematics, photos).

**Triggers**:
- Intent boost for figures (+10%)
- Guaranteed figure slot if no figures in results
- Anchor boost for figures on same pages as top text (+12%)

---

## Cohere Reranking

**Note**: Cohere reranking does NOT use prompts - it's a trained model that reorders results by relevance.

**Location**: `supabase/functions/search-unified/index.ts` (lines 43-117)

**Model**: `rerank-english-v3.0`

**Parameters**:
- `query`: User's search query
- `documents`: Combined text chunks + figures (up to 60 items)
- `top_n`: Returns top 15 after reranking
- `return_documents`: false (only returns relevance scores)

**Post-processing**:
1. Visual figures get +20% boost
2. Text-only figures get -50% penalty
3. Results re-sorted by adjusted scores

---

## Query Expansion

### Location
`supabase/functions/chat-manual/index.ts` (lines 84-94)

### Symptom-Based Expansion

**Example**: "balls won't come out"

Gets expanded to:
```
balls won't come out
Synonyms: ball gate, ball release, gate motor, gate open sensor, gate closed sensor, ball diverter
```

**Pattern matched**:
```regex
/balls?.*?(won't|wont|don't|dont).*?(come\s*out|dispense|release)|balls?.*?(stuck|jam)/i
```

This helps catch relevant content even if manual uses different terminology.

---

## Technical Specifications Boost

### Location
`supabase/functions/chat-manual/index.ts` (lines 162-177)

### Spec Detection Pattern
```regex
/(?:\b[0-9]+(?:\.[0-9]+)?\s*(v|vac|vdc|ma|ohm|Ω|amp|a)\b|\bj\d{1,3}\b|\bpin\s*\d+\b|\bfuse\s*f?\d+\b)/i
```

**Matches**:
- Voltages: `5V`, `12VDC`, `120VAC`
- Current: `100ma`, `2A`
- Resistance: `10ohm`, `5Ω`
- Connectors: `J1`, `J42`, `pin 5`
- Fuses: `F1`, `fuse 3`

**Effect**: Content with these patterns gets prioritized in search results.

---

## Summary of Changes to Answer Quality

### Page Number Accuracy
**Before**: Could show invalid pages (e.g., page 55 in a 40-page manual)

**Now**:
1. Manual metadata includes `page_count`
2. RAG function validates pages against max count
3. Invalid pages are rejected with warning logs
4. Only valid pages shown in citations

**Code**: `supabase/functions/_shared/rag.ts` (lines 96-159)

---

### Manual Detection Improvements
**Before**: Manual had to be explicitly selected

**Now**:
1. Auto-detects manual from query text
2. Handles abbreviations/nicknames (e.g., "DTC" → "Down the Clown")
3. Only searches detected manual (prevents cross-contamination)
4. Shows toast notification when auto-detected

**Code**: `supabase/functions/chat-manual/index.ts` (lines 876-908)

---

### Figure Retrieval Improvements
**Before**: Very few or zero figures showing up

**Now**:
1. Figures included in Cohere reranking (not filtered out early)
2. Visual queries get guaranteed figure slots
3. Anchor boost: figures on same pages as top text get +12%
4. Intent boost: visual queries give figures +10%
5. Text-only figures filtered completely

**Code**: `supabase/functions/search-unified/index.ts` (lines 193-266)

---

### Detail & Specificity
**Answer Style V2** provides adaptive detail based on retrieval quality:

- **Strong retrieval** (score > 0.85): Full technical detail, specific part numbers, exact procedures
- **Moderate retrieval** (0.65-0.85): Good detail, notes gaps honestly
- **Weak retrieval** (< 0.65): Answers what's available, clearly marks unknowns

This prevents hallucination while still being helpful.

---

## Configuration

### Model Selection

**Backend operations** (embeddings, internal processing):
- Secret: `BACKEND_MODEL`
- Default: `gpt-5-2025-08-07`

**User-facing chat**:
- Database: `ai_config` table, `chat_model` key
- Fallback: `CHAT_MODEL` secret → `gpt-5-2025-08-07`

**Manual detection**:
- Model: `claude-sonnet-4-5`
- Via: Lovable AI Gateway

**Clarification questions**:
- Model: `gpt-4.1-mini`

### Feature Flags

**`ANSWER_STYLE`**: `"conversational"` | `"structured"`
- Controls system prompt format

**`ANSWER_STYLE_V2`**: `"0"` | `"1"`
- Enables adaptive prompts based on retrieval quality

**`ENABLE_RUNDOWN`**: `"true"` | `"false"`
- Enables overview/architecture mode

---

## Viewing Prompts in Logs

Edge function logs show actual prompts sent to AI:

```
🤖 Generating answer with model: gpt-5-2025-08-07
📤 [Responses API] Calling https://api.openai.com/v1/responses
📝 Body preview: {"model":"gpt-5-2025-08-07","input":[{"role":"system"...
```

Access logs at:
https://supabase.com/dashboard/project/wryxbfnmecjffxolcgfa/functions/chat-manual/logs
