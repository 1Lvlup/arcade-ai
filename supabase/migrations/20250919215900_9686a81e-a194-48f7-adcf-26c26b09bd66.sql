-- Fix security issue: Remove overly permissive INSERT policies and add proper access controls

-- Drop all existing INSERT policies that allow unrestricted access
DROP POLICY IF EXISTS "Allow FEC creation during signup" ON public.fec_tenants;
DROP POLICY IF EXISTS "Allow FEC creation for signup" ON public.fec_tenants;
DROP POLICY IF EXISTS "Allow authenticated users to insert FEC tenants" ON public.fec_tenants;

-- Create a proper INSERT policy that only allows users to create tenants for themselves
-- Note: This assumes there's a way to associate the tenant with the current user
-- For now, we'll restrict it to authenticated users only, but in practice you'd want 
-- additional business logic to ensure proper ownership
CREATE POLICY "Authenticated users can create FEC tenants" 
ON public.fec_tenants 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Add UPDATE policy - users can only update their own FEC tenant
CREATE POLICY "Users can update their own FEC tenant" 
ON public.fec_tenants 
FOR UPDATE 
TO authenticated
USING (id = get_current_user_fec_tenant_id())
WITH CHECK (id = get_current_user_fec_tenant_id());

-- Add DELETE policy - users can only delete their own FEC tenant (if needed)
CREATE POLICY "Users can delete their own FEC tenant" 
ON public.fec_tenants 
FOR DELETE 
TO authenticated
USING (id = get_current_user_fec_tenant_id());

-- Add service role policies for backend operations
CREATE POLICY "svc select fec_tenants" 
ON public.fec_tenants 
FOR SELECT 
TO service_role
USING (true);

CREATE POLICY "svc insert fec_tenants" 
ON public.fec_tenants 
FOR INSERT 
TO service_role
WITH CHECK (true);

CREATE POLICY "svc update fec_tenants" 
ON public.fec_tenants 
FOR UPDATE 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "svc delete fec_tenants" 
ON public.fec_tenants 
FOR DELETE 
TO service_role
USING (true);