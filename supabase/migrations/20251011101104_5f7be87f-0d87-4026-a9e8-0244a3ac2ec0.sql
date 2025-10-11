-- Fix admin_backfill_manual to target chunks_text instead of rag_chunks
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
      -- Just count affected rows in chunks_text
      SELECT COUNT(*) INTO v_count
      FROM public.chunks_text
      WHERE manual_id = p_manual_id;
      
      v_result := jsonb_build_object(
        'manual_id', p_manual_id,
        'dry_run', TRUE,
        'would_update', v_count,
        'metadata_preview', v_metadata,
        'table', 'chunks_text'
      );
    ELSE
      -- Update chunks_text (not rag_chunks)
      -- Note: chunks_text doesn't have a metadata column, so we can't backfill it
      -- This is a structural issue - chunks_text needs metadata column or we need to use rag_chunks
      v_result := jsonb_build_object(
        'manual_id', p_manual_id,
        'dry_run', FALSE,
        'error', 'chunks_text table does not have metadata column - cannot backfill',
        'suggestion', 'Data needs to be migrated to rag_chunks table first'
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