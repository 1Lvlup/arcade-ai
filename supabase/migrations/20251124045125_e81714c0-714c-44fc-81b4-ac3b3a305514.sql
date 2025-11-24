-- Add RLS policy for guest_usage_limits table
ALTER TABLE public.guest_usage_limits ENABLE ROW LEVEL SECURITY;

-- Policy for service/edge functions to manage guest usage
CREATE POLICY "Service can manage guest usage"
ON public.guest_usage_limits
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);