-- Create SMS logs table for analytics
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fec_tenant_id uuid NOT NULL REFERENCES public.fec_tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  event_type text NOT NULL CHECK (event_type IN ('message', 'opt_in', 'opt_out', 'error')),
  
  -- Message content
  message_body text,
  question_text text,
  ai_response text,
  
  -- Response metrics
  response_time_ms integer,
  truncated boolean DEFAULT false,
  
  -- Context
  manual_id text,
  facility_name text,
  
  -- Twilio metadata
  twilio_message_sid text,
  twilio_status text,
  
  -- Analytics
  topic_category text,
  
  -- Error tracking
  error_message text,
  
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_tenant ON public.sms_logs(fec_tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON public.sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_event ON public.sms_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_sms_logs_user ON public.sms_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_topic ON public.sms_logs(topic_category);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all SMS logs for their tenant
CREATE POLICY "Admins can view sms logs for their tenant"
  ON public.sms_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    AND fec_tenant_id = get_current_user_fec_tenant_id()
  );

-- Service role can insert logs
CREATE POLICY "Service can insert sms logs"
  ON public.sms_logs FOR INSERT
  WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- Service role can select logs
CREATE POLICY "Service can select sms logs"
  ON public.sms_logs FOR SELECT
  USING (fec_tenant_id = get_current_tenant_context());