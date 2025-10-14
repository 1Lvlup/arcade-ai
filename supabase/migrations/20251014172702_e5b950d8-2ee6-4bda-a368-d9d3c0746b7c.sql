-- Create query logs table for tracking retrieval performance
CREATE TABLE IF NOT EXISTS public.query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  manual_id TEXT,
  query_text TEXT NOT NULL,
  normalized_query TEXT,
  model_name TEXT,
  retrieval_method TEXT,
  top_doc_ids TEXT[],
  top_doc_scores DOUBLE PRECISION[],
  top_doc_pages TEXT[],
  vector_mean DOUBLE PRECISION,
  rerank_mean DOUBLE PRECISION,
  keyword_match_ratio DOUBLE PRECISION,
  image_ocr_match_ratio DOUBLE PRECISION,
  unique_docs_matched INTEGER,
  quality_score DOUBLE PRECISION,
  quality_tier TEXT,
  claim_coverage DOUBLE PRECISION,
  response_text TEXT,
  grounding_sources TEXT[],
  human_label TEXT,
  human_correction TEXT,
  photo_url TEXT,
  success_after_fix BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.query_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view their own query logs
CREATE POLICY "Users can view their own query logs"
  ON public.query_logs
  FOR SELECT
  USING (user_id = auth.uid() OR fec_tenant_id = get_current_user_fec_tenant_id());

-- RLS Policies: Service can manage all query logs
CREATE POLICY "svc insert query_logs"
  ON public.query_logs
  FOR INSERT
  WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc select query_logs"
  ON public.query_logs
  FOR SELECT
  USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update query_logs"
  ON public.query_logs
  FOR UPDATE
  USING (fec_tenant_id = get_current_tenant_context());

-- RLS Policies: Admins can view all logs for their tenant
CREATE POLICY "Admins can view tenant query logs"
  ON public.query_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) AND fec_tenant_id = get_current_user_fec_tenant_id());

-- RLS Policies: Admins can update logs (for human labels/corrections)
CREATE POLICY "Admins can update query logs"
  ON public.query_logs
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) AND fec_tenant_id = get_current_user_fec_tenant_id());

-- Create trigger for updated_at
CREATE TRIGGER update_query_logs_updated_at
  BEFORE UPDATE ON public.query_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_query_logs_tenant ON public.query_logs(fec_tenant_id);
CREATE INDEX idx_query_logs_user ON public.query_logs(user_id);
CREATE INDEX idx_query_logs_manual ON public.query_logs(manual_id);
CREATE INDEX idx_query_logs_created_at ON public.query_logs(created_at DESC);
CREATE INDEX idx_query_logs_quality ON public.query_logs(quality_tier, quality_score);
CREATE INDEX idx_query_logs_human_label ON public.query_logs(human_label) WHERE human_label IS NOT NULL;