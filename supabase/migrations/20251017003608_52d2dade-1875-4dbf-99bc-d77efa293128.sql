-- Create feedback table for quick thumbs up/down on queries
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_log_id UUID NOT NULL REFERENCES public.query_logs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  converted_to_training BOOLEAN NOT NULL DEFAULT false,
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

-- Create index for faster lookups
CREATE INDEX idx_feedback_query_log_id ON public.feedback(query_log_id);
CREATE INDEX idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX idx_feedback_rating ON public.feedback(rating);
CREATE INDEX idx_feedback_converted ON public.feedback(converted_to_training);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Admins can view all feedback for their tenant
CREATE POLICY "Admins can view all feedback for their tenant"
ON public.feedback
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) AND fec_tenant_id = get_current_user_fec_tenant_id());

-- Users can create feedback
CREATE POLICY "Users can create feedback"
ON public.feedback
FOR INSERT
WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id() AND auth.uid() = user_id);

-- Admins can update feedback (e.g., mark as converted)
CREATE POLICY "Admins can update feedback"
ON public.feedback
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) AND fec_tenant_id = get_current_user_fec_tenant_id());

-- Service context policies
CREATE POLICY "svc insert feedback"
ON public.feedback
FOR INSERT
WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc select feedback"
ON public.feedback
FOR SELECT
USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update feedback"
ON public.feedback
FOR UPDATE
USING (fec_tenant_id = get_current_tenant_context());