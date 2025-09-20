-- Create tenant context function for service operations
CREATE OR REPLACE FUNCTION public.set_tenant_context(tenant_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current tenant context
CREATE OR REPLACE FUNCTION public.get_current_tenant_context()
RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update rag_chunks policies - replace unrestricted svc policies with tenant-scoped ones
DROP POLICY IF EXISTS "svc select rag_chunks" ON public.rag_chunks;
DROP POLICY IF EXISTS "svc insert rag_chunks" ON public.rag_chunks;
DROP POLICY IF EXISTS "svc update rag_chunks" ON public.rag_chunks;

CREATE POLICY "svc select rag_chunks" 
ON public.rag_chunks 
FOR SELECT 
USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc insert rag_chunks" 
ON public.rag_chunks 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update rag_chunks" 
ON public.rag_chunks 
FOR UPDATE 
USING (fec_tenant_id = get_current_tenant_context())
WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- Update chunks_text policies
DROP POLICY IF EXISTS "svc insert chunks" ON public.chunks_text;
DROP POLICY IF EXISTS "svc select chunks" ON public.chunks_text;
DROP POLICY IF EXISTS "svc update chunks" ON public.chunks_text;

CREATE POLICY "svc select chunks" 
ON public.chunks_text 
FOR SELECT 
USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc insert chunks" 
ON public.chunks_text 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update chunks" 
ON public.chunks_text 
FOR UPDATE 
USING (fec_tenant_id = get_current_tenant_context())
WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- Update figures policies
DROP POLICY IF EXISTS "svc insert figures" ON public.figures;
DROP POLICY IF EXISTS "svc select figures" ON public.figures;
DROP POLICY IF EXISTS "svc update figures" ON public.figures;

CREATE POLICY "svc select figures" 
ON public.figures 
FOR SELECT 
USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc insert figures" 
ON public.figures 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update figures" 
ON public.figures 
FOR UPDATE 
USING (fec_tenant_id = get_current_tenant_context())
WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- Update documents policies
DROP POLICY IF EXISTS "svc insert documents" ON public.documents;
DROP POLICY IF EXISTS "svc select documents" ON public.documents;
DROP POLICY IF EXISTS "svc update documents" ON public.documents;

CREATE POLICY "svc select documents" 
ON public.documents 
FOR SELECT 
USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc insert documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update documents" 
ON public.documents 
FOR UPDATE 
USING (fec_tenant_id = get_current_tenant_context())
WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- Update fec_tenants policies - use id instead of fec_tenant_id since this is the tenant table itself
DROP POLICY IF EXISTS "svc insert fec_tenants" ON public.fec_tenants;
DROP POLICY IF EXISTS "svc update fec_tenants" ON public.fec_tenants;
DROP POLICY IF EXISTS "svc delete fec_tenants" ON public.fec_tenants;
DROP POLICY IF EXISTS "svc select fec_tenants restricted" ON public.fec_tenants;

CREATE POLICY "svc select fec_tenants" 
ON public.fec_tenants 
FOR SELECT 
USING (id = get_current_tenant_context());

CREATE POLICY "svc insert fec_tenants" 
ON public.fec_tenants 
FOR INSERT 
WITH CHECK (id = get_current_tenant_context());

CREATE POLICY "svc update fec_tenants" 
ON public.fec_tenants 
FOR UPDATE 
USING (id = get_current_tenant_context())
WITH CHECK (id = get_current_tenant_context());

CREATE POLICY "svc delete fec_tenants" 
ON public.fec_tenants 
FOR DELETE 
USING (id = get_current_tenant_context());