-- =============================================
-- PHASE 1: Manual Metadata System (Qualified Names)
-- =============================================

-- Drop existing function if signature changed
DROP FUNCTION IF EXISTS public.upsert_manual_metadata(jsonb);

-- 1. Create manual_metadata table
CREATE TABLE IF NOT EXISTS public.manual_metadata (
  manual_id TEXT PRIMARY KEY,
  canonical_title TEXT NOT NULL,
  canonical_slug TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  aliases_slugs TEXT[] DEFAULT '{}',
  manufacturer TEXT,
  platform TEXT,
  family TEXT,
  model_number TEXT,
  doc_type TEXT,
  version TEXT,
  language TEXT DEFAULT 'en',
  page_count INTEGER,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by TEXT,
  source_path TEXT,
  checksum TEXT,
  tags TEXT[] DEFAULT '{}',
  quality_score NUMERIC,
  ingest_status TEXT DEFAULT 'pending',
  notes TEXT,
  requires_reindex BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create normalize_name function
CREATE OR REPLACE FUNCTION public.normalize_name(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN TRIM(REGEXP_REPLACE(
    REGEXP_REPLACE(
      LOWER(COALESCE(input_text, '')),
      '[^a-z0-9]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
END;
$$;

-- 3. Create slugify function
CREATE OR REPLACE FUNCTION public.slugify(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN REPLACE(public.normalize_name(input_text), ' ', '-');
END;
$$;

-- 4. Create upsert_manual_metadata RPC (with qualified names to avoid ambiguity)
CREATE OR REPLACE FUNCTION public.upsert_manual_metadata(p_metadata JSONB)
RETURNS TABLE(out_manual_id TEXT, out_canonical_slug TEXT, out_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_manual_id TEXT;
  v_canonical_title TEXT;
  v_canonical_slug TEXT;
  v_aliases TEXT[];
  v_aliases_slugs TEXT[];
  v_alias TEXT;
BEGIN
  -- Extract required fields
  v_manual_id := p_metadata->>'manual_id';
  v_canonical_title := p_metadata->>'canonical_title';
  
  IF v_manual_id IS NULL OR v_canonical_title IS NULL THEN
    RAISE EXCEPTION 'manual_id and canonical_title are required';
  END IF;
  
  -- Generate canonical_slug
  v_canonical_slug := public.slugify(v_canonical_title);
  
  -- Extract and slugify aliases
  v_aliases := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_metadata->'aliases', '[]'::jsonb)));
  v_aliases_slugs := ARRAY[]::TEXT[];
  
  FOREACH v_alias IN ARRAY v_aliases
  LOOP
    v_aliases_slugs := array_append(v_aliases_slugs, public.slugify(v_alias));
  END LOOP;
  
  -- Upsert manual_metadata
  INSERT INTO public.manual_metadata (
    manual_id, canonical_title, canonical_slug, aliases, aliases_slugs,
    manufacturer, platform, family, model_number, doc_type, version,
    language, page_count, uploaded_by, source_path, checksum, tags,
    quality_score, ingest_status, notes, requires_reindex, updated_at
  ) VALUES (
    v_manual_id,
    v_canonical_title,
    v_canonical_slug,
    v_aliases,
    v_aliases_slugs,
    p_metadata->>'manufacturer',
    p_metadata->>'platform',
    p_metadata->>'family',
    p_metadata->>'model_number',
    p_metadata->>'doc_type',
    p_metadata->>'version',
    COALESCE(p_metadata->>'language', 'en'),
    (p_metadata->>'page_count')::INTEGER,
    p_metadata->>'uploaded_by',
    p_metadata->>'source_path',
    p_metadata->>'checksum',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_metadata->'tags', '[]'::jsonb))),
    (p_metadata->>'quality_score')::NUMERIC,
    COALESCE(p_metadata->>'ingest_status', 'ingested'),
    p_metadata->>'notes',
    COALESCE((p_metadata->>'requires_reindex')::BOOLEAN, FALSE),
    NOW()
  )
  ON CONFLICT (manual_id) DO UPDATE SET
    canonical_title = EXCLUDED.canonical_title,
    canonical_slug = EXCLUDED.canonical_slug,
    aliases = EXCLUDED.aliases,
    aliases_slugs = EXCLUDED.aliases_slugs,
    manufacturer = EXCLUDED.manufacturer,
    platform = EXCLUDED.platform,
    family = EXCLUDED.family,
    model_number = EXCLUDED.model_number,
    doc_type = EXCLUDED.doc_type,
    version = EXCLUDED.version,
    language = EXCLUDED.language,
    page_count = EXCLUDED.page_count,
    uploaded_by = EXCLUDED.uploaded_by,
    source_path = EXCLUDED.source_path,
    checksum = EXCLUDED.checksum,
    tags = EXCLUDED.tags,
    quality_score = EXCLUDED.quality_score,
    ingest_status = EXCLUDED.ingest_status,
    notes = EXCLUDED.notes,
    requires_reindex = EXCLUDED.requires_reindex,
    updated_at = NOW();
  
  RETURN QUERY SELECT v_manual_id AS out_manual_id, v_canonical_slug AS out_canonical_slug, 'success'::TEXT AS out_status;
END;
$$;

-- 5. Create fn_backfill_for_manual RPC
CREATE OR REPLACE FUNCTION public.fn_backfill_for_manual(p_manual_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_metadata JSONB;
BEGIN
  -- Get metadata for the manual
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
  
  -- Update rag_chunks with metadata
  WITH updated AS (
    UPDATE public.rag_chunks rc
    SET metadata = rc.metadata || v_metadata
    WHERE rc.manual_id = p_manual_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  
  RETURN v_count;
END;
$$;

-- 6. Create get_manuals_for_dropdown RPC
CREATE OR REPLACE FUNCTION public.get_manuals_for_dropdown()
RETURNS TABLE(manual_id TEXT, canonical_title TEXT, canonical_slug TEXT, platform TEXT, doc_type TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT mm.manual_id, mm.canonical_title, mm.canonical_slug, mm.platform, mm.doc_type
  FROM public.manual_metadata mm
  ORDER BY mm.canonical_title;
$$;

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_manual_metadata_canonical_slug ON public.manual_metadata(canonical_slug);
CREATE INDEX IF NOT EXISTS idx_manual_metadata_aliases_slugs ON public.manual_metadata USING GIN(aliases_slugs);
CREATE INDEX IF NOT EXISTS idx_manual_metadata_manufacturer ON public.manual_metadata(manufacturer);
CREATE INDEX IF NOT EXISTS idx_manual_metadata_platform ON public.manual_metadata(platform);
CREATE INDEX IF NOT EXISTS idx_manual_metadata_tags ON public.manual_metadata USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_manual_metadata_doc_type ON public.manual_metadata(doc_type);

-- 8. Enable RLS
ALTER TABLE public.manual_metadata ENABLE ROW LEVEL SECURITY;

-- 9. Drop existing policies if present
DROP POLICY IF EXISTS "Users can view manual metadata for their FEC" ON public.manual_metadata;
DROP POLICY IF EXISTS "svc select manual_metadata" ON public.manual_metadata;
DROP POLICY IF EXISTS "svc insert manual_metadata" ON public.manual_metadata;
DROP POLICY IF EXISTS "svc update manual_metadata" ON public.manual_metadata;
DROP POLICY IF EXISTS "Users can update manual metadata for their FEC" ON public.manual_metadata;

-- 10. Create RLS policies
CREATE POLICY "Users can view manual metadata for their FEC"
ON public.manual_metadata FOR SELECT
USING (
  manual_id IN (
    SELECT d.manual_id FROM public.documents d
    WHERE d.fec_tenant_id = get_current_user_fec_tenant_id()
  )
);

CREATE POLICY "svc select manual_metadata"
ON public.manual_metadata FOR SELECT
USING (
  manual_id IN (
    SELECT d.manual_id FROM public.documents d
    WHERE d.fec_tenant_id = get_current_tenant_context()
  )
);

CREATE POLICY "svc insert manual_metadata"
ON public.manual_metadata FOR INSERT
WITH CHECK (
  manual_id IN (
    SELECT d.manual_id FROM public.documents d
    WHERE d.fec_tenant_id = get_current_tenant_context()
  )
);

CREATE POLICY "svc update manual_metadata"
ON public.manual_metadata FOR UPDATE
USING (
  manual_id IN (
    SELECT d.manual_id FROM public.documents d
    WHERE d.fec_tenant_id = get_current_tenant_context()
  )
);

CREATE POLICY "Users can update manual metadata for their FEC"
ON public.manual_metadata FOR UPDATE
USING (
  manual_id IN (
    SELECT d.manual_id FROM public.documents d
    WHERE d.fec_tenant_id = get_current_user_fec_tenant_id()
  )
);

-- 11. Seed high-priority manuals
SELECT public.upsert_manual_metadata(jsonb_build_object(
  'manual_id', 'ice-ball',
  'canonical_title', 'Ice Ball',
  'aliases', jsonb_build_array('ice ball', 'iceball', 'ice-ball'),
  'manufacturer', 'BayTek',
  'platform', 'Redemption',
  'doc_type', 'Service Manual',
  'version', 'FX',
  'tags', jsonb_build_array('redemption', 'ball', 'sensor'),
  'ingest_status', 'ingested'
));

SELECT public.upsert_manual_metadata(jsonb_build_object(
  'manual_id', 'down-the-clown',
  'canonical_title', 'Down The Clown',
  'aliases', jsonb_build_array('down the clown', 'downtheclown', 'dtc'),
  'manufacturer', 'BayTek',
  'platform', 'Redemption',
  'doc_type', 'Service Manual',
  'tags', jsonb_build_array('redemption', 'clown', 'target'),
  'ingest_status', 'ingested'
));

-- 12. Run backfill for seeded manuals
DO $$
DECLARE
  v_ice_ball_count INTEGER;
  v_dtc_count INTEGER;
BEGIN
  -- Backfill Ice Ball
  BEGIN
    SELECT public.fn_backfill_for_manual('ice-ball') INTO v_ice_ball_count;
    RAISE NOTICE 'Ice Ball backfill: % chunks updated', v_ice_ball_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Ice Ball backfill skipped: %', SQLERRM;
  END;
  
  -- Backfill Down The Clown
  BEGIN
    SELECT public.fn_backfill_for_manual('down-the-clown') INTO v_dtc_count;
    RAISE NOTICE 'Down The Clown backfill: % chunks updated', v_dtc_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Down The Clown backfill skipped: %', SQLERRM;
  END;
END $$;