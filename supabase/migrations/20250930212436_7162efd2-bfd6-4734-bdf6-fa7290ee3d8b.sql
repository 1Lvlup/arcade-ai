-- Create golden_questions table
CREATE TABLE IF NOT EXISTS public.golden_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manual_id TEXT NOT NULL,
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL,
  category TEXT NOT NULL,
  importance TEXT NOT NULL,
  expected_keywords TEXT[] DEFAULT '{}',
  filters JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create question_evaluations table
CREATE TABLE IF NOT EXISTS public.question_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.golden_questions(id) ON DELETE CASCADE,
  manual_id TEXT NOT NULL,
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  
  -- RAG Answer
  answer TEXT NOT NULL,
  citations JSONB,
  coverage TEXT,
  
  -- Grading
  score TEXT NOT NULL, -- PASS, PARTIAL, FAIL
  missing_keywords TEXT[],
  rationale TEXT,
  evidence_pages INTEGER[],
  
  -- Metadata
  answer_model TEXT,
  grader_model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.golden_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for golden_questions
CREATE POLICY "Users can view questions for their FEC"
  ON public.golden_questions FOR SELECT
  USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can insert questions for their FEC"
  ON public.golden_questions FOR INSERT
  WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "svc select golden_questions"
  ON public.golden_questions FOR SELECT
  USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc insert golden_questions"
  ON public.golden_questions FOR INSERT
  WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update golden_questions"
  ON public.golden_questions FOR UPDATE
  USING (fec_tenant_id = get_current_tenant_context());

-- RLS Policies for question_evaluations
CREATE POLICY "Users can view evaluations for their FEC"
  ON public.question_evaluations FOR SELECT
  USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "svc select evaluations"
  ON public.question_evaluations FOR SELECT
  USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc insert evaluations"
  ON public.question_evaluations FOR INSERT
  WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update evaluations"
  ON public.question_evaluations FOR UPDATE
  USING (fec_tenant_id = get_current_tenant_context());

-- Create indexes for performance
CREATE INDEX idx_golden_questions_manual ON public.golden_questions(manual_id);
CREATE INDEX idx_golden_questions_tenant ON public.golden_questions(fec_tenant_id);
CREATE INDEX idx_question_evaluations_question ON public.question_evaluations(question_id);
CREATE INDEX idx_question_evaluations_manual ON public.question_evaluations(manual_id);
CREATE INDEX idx_question_evaluations_tenant ON public.question_evaluations(fec_tenant_id);