-- Step 1: Make rpc_audit tolerant of missing tenant id
ALTER TABLE public.rpc_audit
  ALTER COLUMN fec_tenant_id DROP NOT NULL;

-- Step 2: Ensure backfill function runs with privilege to bypass RLS
ALTER FUNCTION public.fn_backfill_for_manual_any(text) SECURITY DEFINER;
ALTER FUNCTION public.fn_backfill_for_manual_any(text) OWNER TO postgres;