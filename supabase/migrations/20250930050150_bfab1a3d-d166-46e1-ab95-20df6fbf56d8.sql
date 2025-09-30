-- Ensure unique constraints exist for the golden configuration
-- Figures must have a unique index on (manual_id, figure_id)
CREATE UNIQUE INDEX IF NOT EXISTS figures_manual_figure_uidx
ON public.figures(manual_id, figure_id);

-- processing_status must be unique on (job_id)
CREATE UNIQUE INDEX IF NOT EXISTS processing_status_job_uidx
ON public.processing_status(job_id);

-- Ensure the set_tenant_context RPC exists (required for golden sequence)
CREATE OR REPLACE FUNCTION public.set_tenant_context(p_tenant_id TEXT)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  PERFORM set_config('app.current_tenant', p_tenant_id, true);
END;
$$;