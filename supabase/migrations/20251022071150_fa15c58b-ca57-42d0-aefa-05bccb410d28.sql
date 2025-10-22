-- =====================================================
-- Phase 1: Query Feedback System
-- Detailed issue tracking for RAG quality improvement
-- =====================================================

-- Create query_feedback table
CREATE TABLE IF NOT EXISTS public.query_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_log_id uuid REFERENCES public.query_logs(id) ON DELETE SET NULL,
  
  -- Issue classification
  issue_type text NOT NULL CHECK (issue_type IN (
    'pagination',
    'cross_manual',
    'image_duplicate',
    'inference',
    'missing_info',
    'incorrect_info',
    'other'
  )),
  
  -- Detailed feedback
  description text NOT NULL,
  reported_pages text[], -- e.g., ['p68', 'p779', 'p35']
  expected_behavior text,
  actual_behavior text,
  
  -- Severity and status
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'wont_fix')),
  
  -- Context
  manual_id text,
  query_text text,
  
  -- Metadata
  fec_tenant_id uuid NOT NULL REFERENCES public.fec_tenants(id) ON DELETE CASCADE,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Add index for common queries
CREATE INDEX idx_query_feedback_tenant ON public.query_feedback(fec_tenant_id);
CREATE INDEX idx_query_feedback_status ON public.query_feedback(status);
CREATE INDEX idx_query_feedback_issue_type ON public.query_feedback(issue_type);
CREATE INDEX idx_query_feedback_manual ON public.query_feedback(manual_id);

-- Enable RLS
ALTER TABLE public.query_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can report feedback for their tenant"
ON public.query_feedback FOR INSERT
WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Admins can view all feedback for their tenant"
ON public.query_feedback FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Admins can update feedback for their tenant"
ON public.query_feedback FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can manage feedback"
ON public.query_feedback FOR ALL
USING (fec_tenant_id = get_current_tenant_context())
WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- Add updated_at trigger
CREATE TRIGGER update_query_feedback_updated_at
BEFORE UPDATE ON public.query_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();