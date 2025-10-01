-- Add columns for V2 pipeline structured data
ALTER TABLE question_evaluations
  ADD COLUMN IF NOT EXISTS answer_json jsonb,
  ADD COLUMN IF NOT EXISTS grade_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS retrieval_debug jsonb;

-- Add helpful comment explaining the columns
COMMENT ON COLUMN question_evaluations.answer_json IS 'Structured JSON answer from RAG pipeline V2 (summary, steps, expert_advice, sources)';
COMMENT ON COLUMN question_evaluations.grade_breakdown IS 'Detailed grading rubric scores (citation_fidelity, specificity, procedure_completeness, etc.)';
COMMENT ON COLUMN question_evaluations.retrieval_debug IS 'Top retrieval candidates with vector scores and rerank scores for debugging';

-- Rename 'score' to 'grade_overall' for clarity (keeping data)
ALTER TABLE question_evaluations
  RENAME COLUMN score TO grade_overall;

-- Keep 'answer' column for backward compatibility but mark as legacy
COMMENT ON COLUMN question_evaluations.answer IS 'LEGACY: Plain text answer (use answer_json for new evaluations)';

-- Remove unused legacy columns if they exist
-- Coverage and rationale might be redundant with grade_breakdown
ALTER TABLE question_evaluations
  DROP COLUMN IF EXISTS coverage CASCADE;