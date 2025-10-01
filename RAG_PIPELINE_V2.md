# RAG Pipeline V2: 3-Stage Generation

## Overview

✅ **Status: Active** - The RAG Pipeline V2 is now the **only** pipeline in production. All legacy code has been removed.

The RAG Pipeline V2 is a **3-stage AI pipeline** for generating high-quality, expert-level answers from technical manuals:

1. **Stage 1 (Draft)**: Generates a manual-only answer using strict grounding
2. **Stage 2 (Expert)**: Enhances the draft with expert troubleshooting knowledge
3. **Stage 3 (Review)**: Ensures correctness, citations, and formatting

## Code Cleanup Completed

The following legacy components have been **permanently removed**:

- ❌ `RAG_PIPELINE_V2` feature flag (no longer needed)
- ❌ `generateResponse()` legacy function
- ❌ `gradeAnswerWithRubric()` function  
- ❌ Text search (`match_chunks_text`) fallback
- ❌ Simple search (`simple_search`) fallback
- ❌ Legacy pipeline branch in serve function

**Current implementation uses ONLY:**
- Vector search with Cohere reranking
- 3-stage pipeline (draft → expert → review)
- Answerability gating
- Temperature 0.2 for troubleshooting

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

## Implementation Status

### ✅ Production Ready

The V2 pipeline is the **sole production implementation**:

1. **3-stage functions active**:
   - `generateDraftAnswer` - Manual-only draft generation
   - `generateExpertAnswer` - Expert knowledge enhancement
   - `reviewAnswer` - Quality control and polish
2. **Unified pipeline function**: `runRagPipelineV2`
3. **Legacy code removed**: All old functions and fallbacks deleted
4. **Single retrieval path**: Vector search + Cohere rerank only

### 🗑️ Removed Components

#### chat-manual/index.ts
- ❌ Feature flag `RAG_PIPELINE_V2` removed
- ❌ `generateResponse()` deleted
- ❌ `gradeAnswerWithRubric()` deleted
- ❌ Text/simple search fallbacks deleted
- ❌ Legacy pipeline branch deleted

#### generate-response/index.ts
- ⚠️ Marked as `@deprecated` for manual-based Q&A
- ℹ️ May still be used for generic chat (greetings, small talk)

#### Other Edge Functions
- ✅ `search-manuals-robust`: Uses hybrid search (kept for debugging)
- ✅ `generate-golden-questions`: Separate use case (question generation)
- ✅ `evaluate-manual`: Separate use case (quality evaluation)
- ✅ `generate-image-caption`: Separate use case (vision AI)

## Testing

### Testing Scenarios

All requests now use the V2 pipeline. Test cases include:

1. **Manual-grounded questions**: Returns draft from manual + expert enhancement
2. **Edge cases**: Questions not in manual trigger expert reasoning
3. **Citations**: All manual facts include page references
4. **Expert advice**: Clearly labeled with `source: "expert"`
5. **Answerability gating**: Low-quality retrievals return honest fallback

## Logs

The pipeline logs each stage clearly:

```
🚀 Using RAG Pipeline V2

🚀 [RAG V2] Starting unified pipeline...
📚 [RAG V2] Retrieved 10 chunks using vector strategy
📝 [STAGE 1] Formatted context with 10 chunks
✅ [STAGE 1] Draft answer generated
🎓 [STAGE 2] Enhancing draft with expert knowledge...
✅ [STAGE 2] Expert answer generated
🔍 [STAGE 3] Reviewing answer for correctness...
✅ [STAGE 3] Answer reviewed and polished
✅ [RAG V2] Pipeline complete
```

## Removed Functions

### 🗑️ No Longer Available

- ❌ `generateResponse(query, chunks)` - **REMOVED** (legacy single-call)
- ❌ `gradeAnswerWithRubric()` - **REMOVED** (old grading system)
- ❌ Text search fallback (`match_chunks_text`) - **REMOVED**
- ❌ Simple search fallback (`simple_search`) - **REMOVED**

### ✅ Active Functions

- `runRagPipelineV2(query, manual_id, tenant_id)` - **Only pipeline for manual Q&A**
- `searchChunks(query, manual_id, tenant_id)` - Vector search + Cohere rerank

## Future Improvements

- [ ] Add streaming support for V2 pipeline
- [ ] Cache Stage 1 drafts for repeated questions
- [ ] Add quality metrics dashboard
- [ ] Add user feedback collection for answer quality
- [ ] Implement confidence scores per answer

## Support

For issues or questions:

1. **Edge function logs**: Check Supabase dashboard
2. **Temperature settings**: All troubleshooting uses 0.2
3. **Retrieval tuning**: See `TUNING_DEFAULTS.md`
4. **Code issues**: Legacy code removed - no rollback available

**Note**: Since legacy code has been removed, there is no rollback option. All changes are forward-only.
