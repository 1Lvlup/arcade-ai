-- Drop ALL versions of match_chunks_improved with their exact signatures
DROP FUNCTION IF EXISTS public.match_chunks_improved(extensions.vector, integer, double precision, text, uuid);
DROP FUNCTION IF EXISTS public.match_chunks_improved(extensions.vector, text, uuid, integer, real);

-- Drop ALL versions of match_chunks_text with their exact signatures
DROP FUNCTION IF EXISTS public.match_chunks_text(text, integer, text, uuid);
DROP FUNCTION IF EXISTS public.match_chunks_text(text, text, uuid, integer);

-- Recreate match_chunks_improved with single clean definition (no tenant filtering)
CREATE OR REPLACE FUNCTION public.match_chunks_improved(
  query_embedding extensions.vector,
  manual text DEFAULT NULL,
  tenant_id uuid DEFAULT NULL,  -- Kept for API compatibility but ignored
  top_k integer DEFAULT 20,
  min_score real DEFAULT 0.3
)
RETURNS TABLE(
  id uuid,
  manual_id text,
  content text,
  page_start integer,
  page_end integer,
  menu_path text,
  score real,
  content_type text,
  storage_url text,
  figure_type text
)
LANGUAGE sql
STABLE
AS $function$
-- Search text chunks (no tenant filtering - everyone can access all manuals)
SELECT 
  c.id,
  c.manual_id,
  c.content,
  c.page_start,
  c.page_end,
  c.menu_path,
  1 - (c.embedding <=> query_embedding) AS score,
  'text'::text as content_type,
  NULL::text as storage_url,
  NULL::text as figure_type
FROM chunks_text c
WHERE (manual IS NULL OR c.manual_id = manual)
  AND c.embedding IS NOT NULL
  AND (1 - (c.embedding <=> query_embedding)) >= min_score

UNION ALL

-- Search figures with OCR text + captions (no tenant filtering)
SELECT 
  f.id,
  f.manual_id,
  COALESCE(f.caption_text, '') || E'\n\n' || COALESCE(f.ocr_text, '') as content,
  f.page_number as page_start,
  f.page_number as page_end,
  NULL as menu_path,
  1 - (f.embedding_text <=> query_embedding) AS score,
  'figure'::text as content_type,
  f.storage_url,
  f.figure_type
FROM figures f
WHERE (manual IS NULL OR f.manual_id = manual)
  AND f.embedding_text IS NOT NULL
  AND (f.ocr_status = 'completed' OR f.ocr_status = 'success')
  AND (1 - (f.embedding_text <=> query_embedding)) >= min_score

ORDER BY score DESC
LIMIT top_k
$function$;

-- Recreate match_chunks_text with single clean definition (no tenant filtering)
CREATE OR REPLACE FUNCTION public.match_chunks_text(
  query_text text,
  manual text DEFAULT NULL,
  tenant_id uuid DEFAULT NULL,  -- Kept for API compatibility but ignored
  top_k integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  manual_id text,
  content text,
  page_start integer,
  page_end integer,
  menu_path text,
  score real,
  content_type text
)
LANGUAGE sql
STABLE
AS $function$
WITH 
-- First try exact phrase matching (no tenant filtering)
phrase_search AS (
  SELECT 
    c.id, c.manual_id, c.content, c.page_start, c.page_end, c.menu_path,
    ts_rank(to_tsvector('english', c.content), phraseto_tsquery('english', query_text)) AS score,
    'text'::text as content_type
  FROM chunks_text c
  WHERE to_tsvector('english', c.content) @@ phraseto_tsquery('english', query_text)
    AND (manual IS NULL OR c.manual_id = manual)
),
-- Then try OR matching (any word can match)
or_search AS (
  SELECT 
    c.id, c.manual_id, c.content, c.page_start, c.page_end, c.menu_path,
    ts_rank(
      to_tsvector('english', c.content), 
      to_tsquery('english', array_to_string(string_to_array(trim(query_text), ' '), ' | '))
    ) AS score,
    'text'::text as content_type
  FROM chunks_text c
  WHERE to_tsvector('english', c.content) @@ to_tsquery('english', array_to_string(string_to_array(trim(query_text), ' '), ' | '))
    AND (manual IS NULL OR c.manual_id = manual)
),
-- Finally try AND matching (original strict approach)
and_search AS (
  SELECT 
    c.id, c.manual_id, c.content, c.page_start, c.page_end, c.menu_path,
    ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) AS score,
    'text'::text as content_type
  FROM chunks_text c
  WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', query_text)
    AND (manual IS NULL OR c.manual_id = manual)
),
-- Combine all results, prioritizing phrase > OR > AND
all_results AS (
  SELECT *, 1 as priority FROM phrase_search
  UNION ALL
  SELECT *, 2 as priority FROM or_search
  UNION ALL 
  SELECT *, 3 as priority FROM and_search
)
-- Return deduplicated results, keeping the best match for each chunk
SELECT DISTINCT ON (id) 
  id, manual_id, content, page_start, page_end, menu_path, score, content_type
FROM all_results
ORDER BY id, priority, score DESC
LIMIT top_k
$function$;