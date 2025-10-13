-- Populate manual_metadata from documents table for all missing manuals
INSERT INTO public.manual_metadata (
  manual_id,
  canonical_title,
  canonical_slug,
  source_path,
  ingest_status,
  uploaded_by,
  upload_date
)
SELECT 
  d.manual_id,
  COALESCE(d.title, d.manual_id) as canonical_title,
  public.slugify(COALESCE(d.title, d.manual_id)) as canonical_slug,
  d.source_filename as source_path,
  'ingested' as ingest_status,
  'system_migration' as uploaded_by,
  d.created_at as upload_date
FROM public.documents d
WHERE NOT EXISTS (
  SELECT 1 FROM public.manual_metadata mm 
  WHERE mm.manual_id = d.manual_id
)
ON CONFLICT (manual_id) DO NOTHING;