-- Enable RLS on manual_page_map
ALTER TABLE public.manual_page_map ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for manual_page_map
CREATE POLICY "Admins can view manual page maps"
ON public.manual_page_map
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage manual page maps"
ON public.manual_page_map
FOR ALL
USING (true)
WITH CHECK (true);