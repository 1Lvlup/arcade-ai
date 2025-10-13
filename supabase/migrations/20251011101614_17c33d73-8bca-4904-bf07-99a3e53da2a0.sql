-- ========================================
-- ROBUST MULTI-TABLE BACKFILL SOLUTION
-- ========================================

-- 1. Add metadata column to chunks_text if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chunks_text' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.chunks_text ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. Create/replace the multi-table backfill function
CREATE OR REPLACE FUNCTION public.fn_backfill_for_manual_any(p_manual_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_canonical_slug TEXT;
  v_manufacturer TEXT;
  v_platform TEXT;
  v_doc_type TEXT;
  v_version TEXT;
  v_tags TEXT[];
  v_updated_chunks_text INT := 0;
  v_updated_rag_chunks INT := 0;
  v_total INT := 0;
  v_metadata JSONB;
BEGIN
  -- Fetch metadata from manual_metadata
  SELECT 
    canonical_title,
    canonical_slug,
    manufacturer,
    platform,
    doc_type,
    version,
    tags
  INTO 
    v_title,
    v_canonical_slug,
    v_manufacturer,
    v_platform,
    v_doc_type,
    v_version,
    v_tags
  FROM public.manual_metadata
  WHERE manual_id = p_manual_id
  LIMIT 1;

  IF v_title IS NULL THEN
    INSERT INTO public.rpc_audit(rpc_name, user_id, payload, result, fec_tenant_id)
    VALUES (
      'fn_backfill_for_manual_any',
      auth.uid(),
      jsonb_build_object('manual_id', p_manual_id),
      jsonb_build_object('error', 'no_manual_metadata_found'),
      get_current_user_fec_tenant_id()
    );
    RETURN jsonb_build_object(
      'manual_id', p_manual_id,
      'updated_chunks_text', 0,
      'updated_rag_chunks', 0,
      'total', 0,
      'note', 'no manual_metadata row found'
    );
  END IF;

  -- Build metadata object
  v_metadata := jsonb_build_object(
    'game_title', v_title,
    'canonical_slug', v_canonical_slug,
    'manufacturer', v_manufacturer,
    'platform', v_platform,
    'doc_type', v_doc_type,
    'version', v_version,
    'tags', to_jsonb(v_tags)
  );

  -- Update chunks_text (only fill blanks, idempotent)
  UPDATE public.chunks_text
  SET metadata = COALESCE(metadata, '{}'::jsonb) || v_metadata
  WHERE manual_id = p_manual_id
    AND COALESCE(metadata->>'game_title', '') = '';

  GET DIAGNOSTICS v_updated_chunks_text = ROW_COUNT;

  -- Update rag_chunks (only fill blanks, idempotent)
  UPDATE public.rag_chunks
  SET metadata = COALESCE(metadata, '{}'::jsonb) || v_metadata
  WHERE manual_id = p_manual_id
    AND COALESCE(metadata->>'game_title', '') = '';

  GET DIAGNOSTICS v_updated_rag_chunks = ROW_COUNT;

  v_total := COALESCE(v_updated_chunks_text, 0) + COALESCE(v_updated_rag_chunks, 0);

  -- Audit the invocation
  INSERT INTO public.rpc_audit(rpc_name, user_id, payload, result, fec_tenant_id)
  VALUES (
    'fn_backfill_for_manual_any',
    auth.uid(),
    jsonb_build_object('manual_id', p_manual_id),
    jsonb_build_object(
      'updated_chunks_text', v_updated_chunks_text,
      'updated_rag_chunks', v_updated_rag_chunks,
      'total', v_total
    ),
    get_current_user_fec_tenant_id()
  );

  RETURN jsonb_build_object(
    'manual_id', p_manual_id,
    'updated_chunks_text', v_updated_chunks_text,
    'updated_rag_chunks', v_updated_rag_chunks,
    'total', v_total
  );
END;
$$;

-- 3. Set owner to postgres (admin role)
ALTER FUNCTION public.fn_backfill_for_manual_any(TEXT) OWNER TO postgres;

-- 4. Grant execute to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION public.fn_backfill_for_manual_any(TEXT) TO authenticated;

-- 5. Update admin_backfill_manual wrapper to use new function
CREATE OR REPLACE FUNCTION public.admin_backfill_manual(p_manual_id TEXT, p_dry_run BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_error TEXT;
  v_count_chunks_text INT;
  v_count_rag_chunks INT;
  v_metadata JSONB;
BEGIN
  -- Check admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  BEGIN
    -- Get metadata preview
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
      -- Count affected rows in both tables
      SELECT COUNT(*) INTO v_count_chunks_text
      FROM public.chunks_text
      WHERE manual_id = p_manual_id
        AND COALESCE(metadata->>'game_title', '') = '';

      SELECT COUNT(*) INTO v_count_rag_chunks
      FROM public.rag_chunks
      WHERE manual_id = p_manual_id
        AND COALESCE(metadata->>'game_title', '') = '';
      
      v_result := jsonb_build_object(
        'manual_id', p_manual_id,
        'dry_run', TRUE,
        'would_update_chunks_text', v_count_chunks_text,
        'would_update_rag_chunks', v_count_rag_chunks,
        'would_update_total', v_count_chunks_text + v_count_rag_chunks,
        'metadata_preview', v_metadata
      );
    ELSE
      -- Actually run backfill
      v_result := public.fn_backfill_for_manual_any(p_manual_id);
      v_result := v_result || jsonb_build_object('dry_run', FALSE);
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