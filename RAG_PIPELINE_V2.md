# RAG Pipeline V2 Migration Guide

## Overview

The RAG Pipeline V2 introduces a **3-stage AI pipeline** for generating high-quality, expert-level answers from technical manuals. This replaces the legacy single-call approach with a more sophisticated system that:

1. **Stage 1 (Draft)**: Generates a manual-only answer using strict grounding
2. **Stage 2 (Expert)**: Enhances the draft with expert troubleshooting knowledge
3. **Stage 3 (Review)**: Ensures correctness, citations, and formatting

## Feature Flag

The pipeline is controlled by the `RAG_PIPELINE_V2` environment variable:

```toml
# In supabase/config.toml
[functions.chat-manual.env]
RAG_PIPELINE_V2 = "true"  # Use V2 pipeline (default)
# RAG_PIPELINE_V2 = "false"  # Use legacy pipeline
```

**Default Behavior:**
- `true` (or unset): Use V2 pipeline
- `false`: Use legacy single-call pipeline

## Architecture

### V2 Pipeline Flow

```
User Query
    ↓
[Retrieval with Cohere Reranking]
    ↓
[Stage 1: generateDraftAnswer]
  - Manual content ONLY
  - Strict grounding
  - Temperature: 0.2
    ↓
[Stage 2: generateExpertAnswer]
  - Add expert knowledge
  - Label manual vs expert advice
  - Temperature: 0.4
    ↓
[Stage 3: reviewAnswer]
  - Ensure correctness
  - Verify citations
  - Polish formatting
  - Temperature: 0
    ↓
[Grading with Rubric]
    ↓
Return Final JSON
```

### Key Functions

#### `runRagPipelineV2(query, manual_id?, tenant_id?)`
**Unified entry point for the V2 pipeline.**

Returns:
```typescript
{
  response: {
    summary: string,
    steps: [{ step: string, expected: string, source: "manual"|"expert" }],
    expert_advice: string[],
    safety: string[],
    sources: [{ page: number, note: string }]
  },
  sources: [...],
  strategy: string,
  chunks: [...],
  pipeline_version: "v2"
}
```

#### `generateDraftAnswer(query, chunks)`
**Stage 1: Manual-only draft**

System Prompt:
```
You are a senior arcade technician. Using ONLY the provided manual content below,
create a structured draft answer. Include citations (page numbers/figures) where you use information.
If the answer is not in the manual, say so clearly in the draft.
Do not guess or add information beyond the manual in this stage.
```

#### `generateExpertAnswer(query, draftJson)`
**Stage 2: Expert enhancement**

System Prompt:
```
You are a master arcade technician mentor. You have:
- The user's question
- A structured draft answer from the manual
- Your own expert knowledge of similar machines and common failures

Tasks:
1. Review the draft for accuracy against the manual.
2. If the manual contains enough info, polish it into a clear, conversational answer.
3. If the manual lacks detail, add your own expert reasoning and best-practice troubleshooting steps beyond the manual (clearly labeled as "Expert Advice").
4. Do not hallucinate specifics about this exact model if unsupported; instead, give generalized best practices or next-step tests a pro would run.
5. Always cite the manual where applicable, and clearly separate "manual content" vs "expert advice."
6. Make the answer conversational, supportive, and actionable.
```

#### `reviewAnswer(query, expertJson)`
**Stage 3: Quality control**

System Prompt:
```
You are a strict reviewer. Ensure:
- All manual facts are accurate and cited.
- Expert advice is clearly labeled as "expert".
- Steps are atomic and actionable (one action per step).
- No hallucinations about page numbers or labels.
Return corrected JSON only.
```

## Migration Checklist

### ✅ Completed Changes

1. **Feature flag added** (`RAG_PIPELINE_V2`)
2. **3-stage functions created**:
   - `generateDraftAnswer`
   - `generateExpertAnswer`
   - `reviewAnswer`
3. **Unified pipeline function**: `runRagPipelineV2`
4. **Main handler updated** to check feature flag
5. **Legacy code preserved** with `@deprecated` markers
6. **Config updated** with environment variable

### 🔍 Functions Reviewed

#### chat-manual/index.ts
- ✅ Updated with feature flag
- ✅ V2 pipeline implemented
- ✅ Legacy pipeline preserved
- ⚠️ Old `generateResponse` marked `@deprecated`

#### generate-response/index.ts
- ⚠️ Marked as `@deprecated` for manual-based Q&A
- ℹ️ Still valid for generic chat (greetings, small talk)

#### Other Edge Functions
- ✅ `search-manuals-robust`: Already uses Cohere reranking
- ✅ `generate-golden-questions`: Separate use case (question generation)
- ✅ `evaluate-manual`: Separate use case (quality evaluation)
- ✅ `generate-image-caption`: Separate use case (vision AI)

## Testing

### Enable V2 Pipeline (Staging/Dev)
```toml
[functions.chat-manual.env]
RAG_PIPELINE_V2 = "true"
```

### Disable V2 Pipeline (Production Rollback)
```toml
[functions.chat-manual.env]
RAG_PIPELINE_V2 = "false"
```

### Testing Scenarios

1. **Manual-grounded questions**: Should return draft from manual + expert enhancement
2. **Edge cases**: Questions not in manual should trigger expert reasoning
3. **Citations**: All manual facts should have page references
4. **Expert advice**: Should be clearly labeled with `source: "expert"`

## Logs

The pipeline logs each stage clearly:

```
🚩 RAG_PIPELINE_V2 feature flag: ENABLED
🚀 [RAG V2] Starting unified pipeline...
📚 [RAG V2] Retrieved 10 chunks using vector+rerank strategy
📝 [STAGE 1] Formatted context with 10 chunks
✅ [STAGE 1] Draft answer generated
🎓 [STAGE 2] Enhancing draft with expert knowledge...
✅ [STAGE 2] Expert answer generated
🔍 [STAGE 3] Reviewing answer for correctness...
✅ [STAGE 3] Answer reviewed and polished
✅ [RAG V2] Pipeline complete
📊 Grading answer quality...
```

## Deprecated Functions

### ⚠️ Do Not Use for Manual Q&A

- `generateResponse(query, chunks)` - Legacy single-call (stuffs context in system prompt)
- `generate-response` edge function - Generic AI without RAG context

### ✅ Use Instead

- `runRagPipelineV2(query, manual_id, tenant_id)` - For all manual-based questions

## Future Improvements

- [ ] Add streaming support for V2 pipeline
- [ ] Cache Stage 1 drafts for repeated questions
- [ ] Add quality metrics dashboard
- [ ] A/B test V2 vs legacy for performance comparison
- [ ] Add user feedback collection for answer quality

## Rollback Plan

If V2 pipeline has issues:

1. Set `RAG_PIPELINE_V2 = "false"` in `config.toml`
2. Redeploy edge function
3. Legacy pipeline will be used automatically
4. All existing functionality preserved

## Questions?

For issues or questions about the V2 pipeline:
1. Check edge function logs: https://supabase.com/dashboard/project/wryxbfnmecjffxolcgfa/functions/chat-manual/logs
2. Review this migration guide
3. Test with feature flag disabled for comparison
