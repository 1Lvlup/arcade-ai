-- Fix match_chunks_improved to accept ocr_status 'success' in addition to 'completed'
DROP FUNCTION IF EXISTS public.match_chunks_improved(extensions.vector, integer, double precision, text, uuid);

CREATE OR REPLACE FUNCTION public.match_chunks_improved(
  query_embedding extensions.vector, 
  top_k integer DEFAULT 12, 
  min_score double precision DEFAULT 0.30, 
  manual text DEFAULT NULL::text, 
  tenant_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  id uuid, 
  manual_id text, 
  content text, 
  page_start integer, 
  page_end integer, 
  menu_path text, 
  score double precision, 
  content_type text
)
LANGUAGE sql
STABLE
AS $function$
-- Search text chunks
SELECT 
  c.id,
  c.manual_id,
  c.content,
  c.page_start,
  c.page_end,
  c.menu_path,
  1 - (c.embedding <=> query_embedding) AS score,
  'text'::text as content_type
FROM chunks_text c
WHERE (manual IS NULL OR c.manual_id = manual)
  AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
  AND c.embedding IS NOT NULL
  AND (1 - (c.embedding <=> query_embedding)) >= min_score

UNION ALL

-- Search figures with OCR text + captions
-- FIXED: Accept both 'completed' AND 'success' status
SELECT 
  f.id,
  f.manual_id,
  COALESCE(f.caption_text, '') || E'\n\n' || COALESCE(f.ocr_text, '') as content,
  f.page_number as page_start,
  f.page_number as page_end,
  NULL as menu_path,
  1 - (f.embedding_text <=> query_embedding) AS score,
  'figure'::text as content_type
FROM figures f
WHERE (manual IS NULL OR f.manual_id = manual)
  AND (tenant_id IS NULL OR f.fec_tenant_id = tenant_id)
  AND f.embedding_text IS NOT NULL
  AND (f.ocr_status = 'completed' OR f.ocr_status = 'success')
  AND (1 - (f.embedding_text <=> query_embedding)) >= min_score

ORDER BY score DESC
LIMIT top_k
$function$;