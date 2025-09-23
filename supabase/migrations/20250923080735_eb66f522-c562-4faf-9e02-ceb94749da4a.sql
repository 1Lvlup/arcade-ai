-- Create processing_status table for real-time job tracking
CREATE TABLE public.processing_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  manual_id TEXT NOT NULL,
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  status TEXT NOT NULL DEFAULT 'starting',
  stage TEXT,
  progress_percent INTEGER DEFAULT 0,
  chunks_processed INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  figures_processed INTEGER DEFAULT 0,
  total_figures INTEGER DEFAULT 0,
  current_task TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processing_status ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view processing status for their FEC only" 
ON public.processing_status 
FOR SELECT 
USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "svc select processing_status" 
ON public.processing_status 
FOR SELECT 
USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc insert processing_status" 
ON public.processing_status 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update processing_status" 
ON public.processing_status 
FOR UPDATE 
USING (fec_tenant_id = get_current_tenant_context())
WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- Add trigger for timestamps
CREATE TRIGGER update_processing_status_updated_at
BEFORE UPDATE ON public.processing_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.processing_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.processing_status;