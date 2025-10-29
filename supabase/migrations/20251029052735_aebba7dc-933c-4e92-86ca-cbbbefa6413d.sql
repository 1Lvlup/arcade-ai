-- Drop existing restrictive admin delete policies
DROP POLICY IF EXISTS "Admins can delete documents for their FEC" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete chunks for their FEC" ON public.chunks_text;
DROP POLICY IF EXISTS "Admins can delete golden questions for their FEC" ON public.golden_questions;
DROP POLICY IF EXISTS "Admins can delete processing status for their FEC" ON public.processing_status;
DROP POLICY IF EXISTS "Admins can delete manual pages" ON public.manual_pages;
DROP POLICY IF EXISTS "Admins can delete feedback for their tenant" ON public.feedback;
DROP POLICY IF EXISTS "Admins can delete model feedback for their tenant" ON public.model_feedback;

-- Create new admin delete policies that work across all tenants
CREATE POLICY "Admins can delete any document"
ON public.documents
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any chunks"
ON public.chunks_text
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any golden questions"
ON public.golden_questions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any processing status"
ON public.processing_status
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any manual pages"
ON public.manual_pages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any feedback"
ON public.feedback
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any model feedback"
ON public.model_feedback
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));