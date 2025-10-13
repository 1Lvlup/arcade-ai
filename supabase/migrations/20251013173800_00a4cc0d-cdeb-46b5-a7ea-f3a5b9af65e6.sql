-- Enhanced backfill function to capture comprehensive metadata
CREATE OR REPLACE FUNCTION public.fn_backfill_for_manual_any(p_manual_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_canonical_slug TEXT;
  v_manufacturer TEXT;
  v_platform TEXT;
  v_doc_type TEXT;
  v_version TEXT;
  v_tags TEXT[];
  v_language TEXT;
  v_page_count INT;
  v_family TEXT;
  v_model_number TEXT;
  v_quality_score NUMERIC;
  v_ingest_status TEXT;
  v_uploaded_by TEXT;
  v_upload_date TIMESTAMP WITH TIME ZONE;
  v_aliases TEXT[];
  v_updated_chunks_text INT := 0;
  v_updated_rag_chunks INT := 0;
  v_total INT := 0;
  v_metadata JSONB;
BEGIN
  -- Fetch comprehensive metadata from manual_metadata
  SELECT 
    canonical_title,
    canonical_slug,
    manufacturer,
    platform,
    doc_type,
    version,
    tags,
    language,
    page_count,
    family,
    model_number,
    quality_score,
    ingest_status,
    uploaded_by,
    upload_date,
    aliases
  INTO 
    v_title,
    v_canonical_slug,
    v_manufacturer,
    v_platform,
    v_doc_type,
    v_version,
    v_tags,
    v_language,
    v_page_count,
    v_family,
    v_model_number,
    v_quality_score,
    v_ingest_status,
    v_uploaded_by,
    v_upload_date,
    v_aliases
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

  -- Build comprehensive metadata object with document-level information
  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    -- Core identification
    'game_title', v_title,
    'canonical_slug', v_canonical_slug,
    'manual_id', p_manual_id,
    
    -- Product information
    'manufacturer', v_manufacturer,
    'platform', v_platform,
    'family', v_family,
    'model_number', v_model_number,
    
    -- Document classification
    'doc_type', v_doc_type,
    'version', v_version,
    'language', v_language,
    'tags', to_jsonb(v_tags),
    'aliases', to_jsonb(v_aliases),
    
    -- Document metrics
    'page_count', v_page_count,
    'quality_score', v_quality_score,
    
    -- Provenance
    'ingest_status', v_ingest_status,
    'uploaded_by', v_uploaded_by,
    'upload_date', v_upload_date
  ));

  -- Update chunks_text (merge with existing metadata, don't overwrite chunk-level metadata)
  UPDATE public.chunks_text
  SET metadata = COALESCE(metadata, '{}'::jsonb) || v_metadata
  WHERE manual_id = p_manual_id
    AND COALESCE(metadata->>'game_title', '') = '';

  GET DIAGNOSTICS v_updated_chunks_text = ROW_COUNT;

  -- Update rag_chunks (merge with existing metadata)
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
$function$;