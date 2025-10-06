-- Add delete policy for figures table so users can delete their own figures
CREATE POLICY "Users can delete figures for their FEC only"
ON public.figures
FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_user_fec_tenant_id());