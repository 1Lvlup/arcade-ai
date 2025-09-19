-- First, add the missing fec_tenant_id column to rag_chunks table
ALTER TABLE public.rag_chunks 
ADD COLUMN fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Update existing RLS policy to use tenant-based access control
DROP POLICY IF EXISTS "Authenticated users can view rag_chunks" ON public.rag_chunks;

CREATE POLICY "Users can view rag_chunks for their FEC only" 
ON public.rag_chunks 
FOR SELECT 
USING (fec_tenant_id = get_current_user_fec_tenant_id());

-- Add INSERT policy for tenant-based access
CREATE POLICY "Users can insert rag_chunks for their FEC only" 
ON public.rag_chunks 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id());

-- Add service role policies for backend operations
CREATE POLICY "svc select rag_chunks" 
ON public.rag_chunks 
FOR SELECT 
USING (true);

CREATE POLICY "svc insert rag_chunks" 
ON public.rag_chunks 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "svc update rag_chunks" 
ON public.rag_chunks 
FOR UPDATE 
USING (true)
WITH CHECK (true);