-- AI Training Hub Database Schema
-- Note: Some tables like training_examples and query_logs already exist
-- This migration extends them to match the spec requirements

-- Extend existing query_logs table with training hub specific columns
ALTER TABLE public.query_logs 
  ADD COLUMN IF NOT EXISTS admin_user text,
  ADD COLUMN IF NOT EXISTS messages jsonb,
  ADD COLUMN IF NOT EXISTS citations jsonb,
  ADD COLUMN IF NOT EXISTS numeric_flags jsonb;

-- Create feedback table (extends model_feedback for training purposes)
CREATE TABLE IF NOT EXISTS public.training_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES public.query_logs(id) ON DELETE CASCADE,
  feedback_type text NOT NULL,
  reason text,
  details text,
  photo_url text,
  time_to_fix_minutes integer,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- Extend training_examples table to match spec
ALTER TABLE public.training_examples
  ADD COLUMN IF NOT EXISTS source_query_id uuid REFERENCES public.query_logs(id),
  ADD COLUMN IF NOT EXISTS doc_id text,
  ADD COLUMN IF NOT EXISTS question text,
  ADD COLUMN IF NOT EXISTS answer text,
  ADD COLUMN IF NOT EXISTS evidence_spans jsonb,
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Create training_exports table
CREATE TABLE IF NOT EXISTS public.training_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  example_count integer NOT NULL,
  filters jsonb,
  file_url text,
  created_by text,
  fec_tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.training_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_exports ENABLE ROW LEVEL SECURITY;

-- RLS policies for training_feedback (admin only)
CREATE POLICY "Admins can manage training feedback"
  ON public.training_feedback
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for training_exports (admin only)
CREATE POLICY "Admins can manage training exports"
  ON public.training_exports
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_query_logs_quality_score ON public.query_logs(quality_score);
CREATE INDEX IF NOT EXISTS idx_query_logs_numeric_flags ON public.query_logs USING gin(numeric_flags);
CREATE INDEX IF NOT EXISTS idx_training_feedback_query_id ON public.training_feedback(query_id);
CREATE INDEX IF NOT EXISTS idx_training_examples_source_query ON public.training_examples(source_query_id);

-- Create function to auto-calculate quality metrics (called by edge function)
CREATE OR REPLACE FUNCTION public.calculate_quality_metrics(
  p_query_id uuid,
  p_response_text text,
  p_top_chunks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claims text[];
  v_numeric_flags jsonb;
  v_claim_coverage float;
  v_quality_score float;
BEGIN
  -- Extract claims (simple sentence split for now)
  v_claims := string_to_array(p_response_text, '.');
  
  -- Detect numeric values
  SELECT jsonb_agg(
    jsonb_build_object(
      'value', m[1],
      'unit', COALESCE(m[2], ''),
      'context', substring(p_response_text FROM position(m[1] IN p_response_text) - 20 FOR 60)
    )
  )
  INTO v_numeric_flags
  FROM regexp_matches(p_response_text, '(\d+\.?\d*)\s*([a-zA-Z]+)?', 'g') m;
  
  -- Calculate claim coverage (simplified - checks if claim words appear in chunks)
  v_claim_coverage := 0.5; -- Placeholder
  
  -- Calculate quality score
  v_quality_score := v_claim_coverage * 0.7 + 
                     CASE WHEN v_numeric_flags IS NULL THEN 0.3 ELSE 0.0 END;
  
  RETURN jsonb_build_object(
    'claims', to_jsonb(v_claims),
    'numeric_flags', COALESCE(v_numeric_flags, '[]'::jsonb),
    'claim_coverage', v_claim_coverage,
    'quality_score', v_quality_score
  );
END;
$$;