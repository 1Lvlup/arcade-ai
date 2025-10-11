-- Fix RLS on tables missing it from the linter warnings

-- Enable RLS on docs table (legacy)
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on chunk_repage_log
ALTER TABLE public.chunk_repage_log ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for chunk_repage_log
CREATE POLICY "Admins can view chunk repage logs"
ON public.chunk_repage_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert chunk repage logs"
ON public.chunk_repage_log
FOR INSERT
WITH CHECK (true); -- Service role will handle this

-- Add RLS policies for docs table (if still in use)
CREATE POLICY "Users can view docs for their FEC"
ON public.docs
FOR SELECT
USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Service can manage docs"
ON public.docs
FOR ALL
USING (fec_tenant_id = get_current_tenant_context())
WITH CHECK (fec_tenant_id = get_current_tenant_context());