-- Create training examples table for storing good examples
CREATE TABLE IF NOT EXISTS public.training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  user_id UUID NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('code_assistant', 'manual_troubleshooting')),
  context TEXT NOT NULL,
  question TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  do_instructions TEXT[], -- Things the model should do
  dont_instructions TEXT[], -- Things the model should NOT do
  tags TEXT[],
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create model feedback table for collecting user feedback
CREATE TABLE IF NOT EXISTS public.model_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  user_id UUID NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('code_assistant', 'manual_troubleshooting')),
  conversation_id UUID,
  query_log_id UUID,
  rating TEXT NOT NULL CHECK (rating IN ('excellent', 'good', 'poor', 'terrible')),
  feedback_text TEXT,
  expected_answer TEXT,
  actual_answer TEXT,
  context JSONB,
  is_converted_to_training BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexed codebase table for pre-cached project files
CREATE TABLE IF NOT EXISTS public.indexed_codebase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  file_path TEXT NOT NULL,
  file_content TEXT NOT NULL,
  language TEXT,
  file_type TEXT,
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fec_tenant_id, file_path)
);

-- Enable RLS
ALTER TABLE public.training_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indexed_codebase ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_examples
CREATE POLICY "Users can view training examples for their tenant"
  ON public.training_examples FOR SELECT
  USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can create training examples"
  ON public.training_examples FOR INSERT
  WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id() AND auth.uid() = user_id);

CREATE POLICY "Users can update their own training examples"
  ON public.training_examples FOR UPDATE
  USING (fec_tenant_id = get_current_user_fec_tenant_id() AND auth.uid() = user_id);

CREATE POLICY "Admins can approve training examples"
  ON public.training_examples FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for model_feedback
CREATE POLICY "Users can view their own feedback"
  ON public.model_feedback FOR SELECT
  USING (fec_tenant_id = get_current_user_fec_tenant_id() AND auth.uid() = user_id);

CREATE POLICY "Users can create feedback"
  ON public.model_feedback FOR INSERT
  WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id() AND auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback for their tenant"
  ON public.model_feedback FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) AND fec_tenant_id = get_current_user_fec_tenant_id());

-- RLS Policies for indexed_codebase
CREATE POLICY "Users can view indexed codebase for their tenant"
  ON public.indexed_codebase FOR SELECT
  USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can manage indexed codebase"
  ON public.indexed_codebase FOR ALL
  USING (fec_tenant_id = get_current_user_fec_tenant_id())
  WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id());

-- Create indexes
CREATE INDEX idx_training_examples_tenant ON public.training_examples(fec_tenant_id);
CREATE INDEX idx_training_examples_model_type ON public.training_examples(model_type);
CREATE INDEX idx_training_examples_approved ON public.training_examples(is_approved);
CREATE INDEX idx_model_feedback_tenant ON public.model_feedback(fec_tenant_id);
CREATE INDEX idx_model_feedback_rating ON public.model_feedback(rating);
CREATE INDEX idx_indexed_codebase_tenant ON public.indexed_codebase(fec_tenant_id);
CREATE INDEX idx_indexed_codebase_file_path ON public.indexed_codebase(file_path);