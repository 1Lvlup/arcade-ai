-- Create answer_evaluations table for automatic AI answer quality assessment
CREATE TABLE IF NOT EXISTS public.answer_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_log_id UUID NOT NULL REFERENCES public.query_logs(id) ON DELETE CASCADE,
  fec_tenant_id UUID NOT NULL DEFAULT get_current_user_fec_tenant_id(),
  
  -- Evaluation metadata
  evaluation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  evaluator_model TEXT NOT NULL DEFAULT 'gpt-5-mini-2025-08-07',
  
  -- Scores (0-100 scale)
  overall_grade TEXT NOT NULL CHECK (overall_grade IN ('A', 'B', 'C', 'D', 'F')),
  accuracy_score INTEGER NOT NULL CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  completeness_score INTEGER NOT NULL CHECK (completeness_score >= 0 AND completeness_score <= 100),
  clarity_score INTEGER NOT NULL CHECK (clarity_score >= 0 AND clarity_score <= 100),
  citation_quality_score INTEGER NOT NULL CHECK (citation_quality_score >= 0 AND citation_quality_score <= 100),
  
  -- Analysis results
  issues_found JSONB DEFAULT '[]'::jsonb,
  improvement_suggestions JSONB DEFAULT '[]'::jsonb,
  strengths JSONB DEFAULT '[]'::jsonb,
  
  -- Automatic actions
  auto_actions_taken JSONB DEFAULT '[]'::jsonb,
  
  -- Full evaluation text for reference
  evaluation_details TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.answer_evaluations ENABLE ROW LEVEL SECURITY;

-- Admin policy: admins can view all evaluations
CREATE POLICY "Admins can view all evaluations"
  ON public.answer_evaluations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin policy: system can insert evaluations (service role)
CREATE POLICY "Service role can insert evaluations"
  ON public.answer_evaluations
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_answer_evaluations_query_log_id ON public.answer_evaluations(query_log_id);
CREATE INDEX idx_answer_evaluations_tenant_id ON public.answer_evaluations(fec_tenant_id);
CREATE INDEX idx_answer_evaluations_overall_grade ON public.answer_evaluations(overall_grade);
CREATE INDEX idx_answer_evaluations_timestamp ON public.answer_evaluations(evaluation_timestamp DESC);

-- Add composite index for common queries
CREATE INDEX idx_answer_evaluations_tenant_grade_time 
  ON public.answer_evaluations(fec_tenant_id, overall_grade, evaluation_timestamp DESC);