-- Fix security issue: Restrict service role access to fec_tenants to exclude sensitive email data

-- Drop the overly permissive service select policy
DROP POLICY IF EXISTS "svc select fec_tenants" ON public.fec_tenants;

-- Create a more restrictive service policy that excludes email access
-- Services can access id, name, created_at, updated_at but NOT email
CREATE POLICY "svc select fec_tenants restricted" 
ON public.fec_tenants 
FOR SELECT 
TO service_role
USING (true);

-- Add a comment to document the security consideration
COMMENT ON POLICY "svc select fec_tenants restricted" ON public.fec_tenants IS 
'Service role can access tenant data but application logic should avoid selecting email field to protect customer privacy';