# RAG System Tuning Defaults

## Retrieval Configuration

### Search Parameters
- **top_k_raw**: 60 candidates initially retrieved
- **rerank_to_top**: 10 (after Cohere reranking)
- **min_score_gate**: 0.30 (pre-rerank threshold, tunable to 0.30-0.35 based on telemetry)

### Chunk Configuration (for ingestion)
- **Chunk size**: 900-1200 characters
  - Keep procedures atomic (don't split multi-step instructions)
  - Maintain semantic boundaries
- **Overlap**: 120-150 characters
  - Ensures context continuity between chunks
  - Helps capture cross-boundary information

## AI Response Generation

### OpenAI Configuration
- **Model**: gpt-4o
- **Temperature**: 0.2 (for grounded, consistent answers)
- **max_tokens**: 900
- **response_format**: json_object

### Context Formatting
- All context blocks are prefixed with page markers: `[pX]` or `[pX-Y]`
- Makes citation extraction trivial for the model
- Example:
  ```
  [p8] Game Board Troubleshooting
  If the board fails POST...
  
  [p12-15] CMOS Battery Replacement
  Replace the CR-2032 battery...
  ```

## Embedding Model
- **Model**: text-embedding-3-small (OpenAI)
- **Purpose**: Convert text to vector embeddings for semantic search

## Reranking
- **Model**: rerank-3 (Cohere)
- **Purpose**: Improve relevance ordering of initial candidates
- **Document truncation**: 1500 characters per document (API limit safety)
- **Fallback**: Falls back to original vector scores if Cohere fails/times out

## Quality Grading
- **Model**: gpt-4o
- **Temperature**: 0 (for consistent evaluation)
- **Rubric Categories**:
  1. citation_fidelity
  2. specificity
  3. procedure_completeness
  4. tooling_context
  5. escalation_outcome
  6. safety_accuracy

## Answerability Threshold
- Minimum 3 chunks required
- OR all scores must be >= 0.3
- OR all rerank_scores must be >= 0.45
- If these fail, return early without GPT call

## Keyword Extraction & Boosting
- Extract technical terms: CR-2032, CMOS, BIOS, HDMI, pins, voltages, error codes
- Apply +0.15 score boost for exact keyword matches
- Helps surface highly relevant technical content

## Performance Targets
- Search completion: < 2000ms
- Total response time: < 5000ms
- Context size: Typically 5-10 chunks after reranking
