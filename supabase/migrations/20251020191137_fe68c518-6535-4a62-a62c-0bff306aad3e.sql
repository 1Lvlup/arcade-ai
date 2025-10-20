-- Allow admins to view all tenants
DROP POLICY IF EXISTS "Admins can view all tenants" ON public.fec_tenants;
CREATE POLICY "Admins can view all tenants"
ON public.fec_tenants
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage tenant_manual_access
DROP POLICY IF EXISTS "Admins can view all tenant manual access" ON public.tenant_manual_access;
CREATE POLICY "Admins can view all tenant manual access"
ON public.tenant_manual_access
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert tenant manual access" ON public.tenant_manual_access;
CREATE POLICY "Admins can insert tenant manual access"
ON public.tenant_manual_access
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update tenant manual access" ON public.tenant_manual_access;
CREATE POLICY "Admins can update tenant manual access"
ON public.tenant_manual_access
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete tenant manual access" ON public.tenant_manual_access;
CREATE POLICY "Admins can delete tenant manual access"
ON public.tenant_manual_access
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));