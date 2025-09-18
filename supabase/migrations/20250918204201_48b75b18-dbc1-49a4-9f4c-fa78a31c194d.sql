-- ===== RLS policies for service_role =====
-- Enable RLS and add policies for service_role to access tables from edge functions

BEGIN;

-- DOCUMENTS table policies
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svc insert documents" ON public.documents;
DROP POLICY IF EXISTS "svc update documents" ON public.documents;
DROP POLICY IF EXISTS "svc select documents" ON public.documents;

CREATE POLICY "svc insert documents"
ON public.documents
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "svc update documents"
ON public.documents
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "svc select documents"
ON public.documents
FOR SELECT
TO service_role
USING (true);

-- CHUNKS_TEXT table policies
ALTER TABLE public.chunks_text ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svc insert chunks" ON public.chunks_text;
DROP POLICY IF EXISTS "svc update chunks" ON public.chunks_text;
DROP POLICY IF EXISTS "svc select chunks" ON public.chunks_text;

CREATE POLICY "svc insert chunks"
ON public.chunks_text
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "svc update chunks"
ON public.chunks_text
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "svc select chunks"
ON public.chunks_text
FOR SELECT
TO service_role
USING (true);

-- FIGURES table policies
ALTER TABLE public.figures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svc insert figures" ON public.figures;
DROP POLICY IF EXISTS "svc update figures" ON public.figures;
DROP POLICY IF EXISTS "svc select figures" ON public.figures;

CREATE POLICY "svc insert figures"
ON public.figures
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "svc update figures"
ON public.figures
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "svc select figures"
ON public.figures
FOR SELECT
TO service_role
USING (true);

-- Fix RPC function permissions
GRANT EXECUTE ON FUNCTION public.search_manual_content(extensions.vector, text, integer, double precision)
TO service_role;

-- Make the function run with owner privileges to bypass RLS inside
ALTER FUNCTION public.search_manual_content(extensions.vector, text, integer, double precision)
SECURITY DEFINER;

COMMIT;