-- ========================================
-- SECURITY PREFLIGHT: Admin RPC Hardening
-- ========================================

-- 1) Create rpc_audit table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.rpc_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rpc_name TEXT NOT NULL,
  payload JSONB,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
);

ALTER TABLE public.rpc_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs for their tenant
CREATE POLICY "Admins can view audit logs"
ON public.rpc_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) AND fec_tenant_id = get_current_user_fec_tenant_id());

-- Service role can insert audit logs
CREATE POLICY "svc insert rpc_audit"
ON public.rpc_audit
FOR INSERT
WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- 2) Add missing RLS policies for manual_metadata
-- (already has SELECT policies, adding INSERT/UPDATE/DELETE for admins only)

CREATE POLICY "Admins can insert manual metadata"
ON public.manual_metadata
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update manual metadata"
ON public.manual_metadata
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete manual metadata"
ON public.manual_metadata
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Add admin-only RLS policies for rag_chunks (INSERT/UPDATE/DELETE)
CREATE POLICY "Admins can insert rag_chunks"
ON public.rag_chunks
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update rag_chunks"
ON public.rag_chunks
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete rag_chunks"
ON public.rag_chunks
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4) Create admin-gated wrapper RPCs with audit logging

-- Trigger reindex RPC
CREATE OR REPLACE FUNCTION public.trigger_reindex(p_manual_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_error TEXT;
  v_count INT;
BEGIN
  -- Check admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  BEGIN
    -- Mark manual for reindex
    UPDATE public.manual_metadata
    SET requires_reindex = TRUE,
        updated_at = NOW()
    WHERE manual_id = p_manual_id;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    v_result := jsonb_build_object(
      'manual_id', p_manual_id,
      'requires_reindex', TRUE,
      'updated_count', v_count,
      'status', 'success'
    );

    -- Audit log
    INSERT INTO public.rpc_audit (user_id, rpc_name, payload, result, fec_tenant_id)
    VALUES (
      auth.uid(),
      'trigger_reindex',
      jsonb_build_object('manual_id', p_manual_id),
      v_result,
      get_current_user_fec_tenant_id()
    );

    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    
    -- Audit error
    INSERT INTO public.rpc_audit (user_id, rpc_name, payload, error, fec_tenant_id)
    VALUES (
      auth.uid(),
      'trigger_reindex',
      jsonb_build_object('manual_id', p_manual_id),
      v_error,
      get_current_user_fec_tenant_id()
    );
    
    RAISE;
  END;
END;
$$;

-- Admin-gated upsert_manual_metadata with audit
CREATE OR REPLACE FUNCTION public.admin_upsert_manual_metadata(p_metadata JSONB)
RETURNS TABLE(out_manual_id TEXT, out_canonical_slug TEXT, out_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
  v_error TEXT;
BEGIN
  -- Check admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  BEGIN
    -- Call existing upsert function
    SELECT * INTO v_result FROM public.upsert_manual_metadata(p_metadata);
    
    -- Audit log
    INSERT INTO public.rpc_audit (user_id, rpc_name, payload, result, fec_tenant_id)
    VALUES (
      auth.uid(),
      'admin_upsert_manual_metadata',
      p_metadata,
      to_jsonb(v_result),
      get_current_user_fec_tenant_id()
    );

    RETURN QUERY SELECT v_result.out_manual_id, v_result.out_canonical_slug, v_result.out_status;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    
    -- Audit error
    INSERT INTO public.rpc_audit (user_id, rpc_name, payload, error, fec_tenant_id)
    VALUES (
      auth.uid(),
      'admin_upsert_manual_metadata',
      p_metadata,
      v_error,
      get_current_user_fec_tenant_id()
    );
    
    RAISE;
  END;
END;
$$;

-- Admin-gated backfill with audit
CREATE OR REPLACE FUNCTION public.admin_backfill_manual(p_manual_id TEXT, p_dry_run BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_error TEXT;
  v_count INT;
  v_metadata JSONB;
BEGIN
  -- Check admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  BEGIN
    -- Get metadata
    SELECT jsonb_build_object(
      'game_title', mm.canonical_title,
      'canonical_slug', mm.canonical_slug,
      'manufacturer', mm.manufacturer,
      'platform', mm.platform,
      'doc_type', mm.doc_type,
      'version', mm.version,
      'tags', mm.tags
    ) INTO v_metadata
    FROM public.manual_metadata mm
    WHERE mm.manual_id = p_manual_id;
    
    IF v_metadata IS NULL THEN
      RAISE EXCEPTION 'Manual % not found in manual_metadata', p_manual_id;
    END IF;

    IF p_dry_run THEN
      -- Just count affected rows
      SELECT COUNT(*) INTO v_count
      FROM public.rag_chunks
      WHERE manual_id = p_manual_id;
      
      v_result := jsonb_build_object(
        'manual_id', p_manual_id,
        'dry_run', TRUE,
        'would_update', v_count,
        'metadata_preview', v_metadata
      );
    ELSE
      -- Actually update
      WITH updated AS (
        UPDATE public.rag_chunks rc
        SET metadata = rc.metadata || v_metadata
        WHERE rc.manual_id = p_manual_id
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_count FROM updated;
      
      v_result := jsonb_build_object(
        'manual_id', p_manual_id,
        'dry_run', FALSE,
        'updated_count', v_count
      );
    END IF;

    -- Audit log
    INSERT INTO public.rpc_audit (user_id, rpc_name, payload, result, fec_tenant_id)
    VALUES (
      auth.uid(),
      'admin_backfill_manual',
      jsonb_build_object('manual_id', p_manual_id, 'dry_run', p_dry_run),
      v_result,
      get_current_user_fec_tenant_id()
    );

    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    
    -- Audit error
    INSERT INTO public.rpc_audit (user_id, rpc_name, payload, error, fec_tenant_id)
    VALUES (
      auth.uid(),
      'admin_backfill_manual',
      jsonb_build_object('manual_id', p_manual_id, 'dry_run', p_dry_run),
      v_error,
      get_current_user_fec_tenant_id()
    );
    
    RAISE;
  END;
END;
$$;

-- 5) Revoke public execute on admin functions
REVOKE EXECUTE ON FUNCTION public.upsert_manual_metadata(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_backfill_for_manual(TEXT) FROM PUBLIC;

-- Grant to authenticated users (will be further restricted by role check inside function)
GRANT EXECUTE ON FUNCTION public.admin_upsert_manual_metadata(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_backfill_manual(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_reindex(TEXT) TO authenticated;