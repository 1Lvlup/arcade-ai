-- Improve text search to be more flexible with complex queries
CREATE OR REPLACE FUNCTION public.match_chunks_text(
  query_text text, 
  top_k int DEFAULT 12, 
  manual text DEFAULT NULL,
  tenant_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  manual_id text,
  content text,
  page_start int,
  page_end int,
  menu_path text,
  score float,
  content_type text
)
LANGUAGE sql STABLE AS
$$
WITH 
-- First try exact phrase matching
phrase_search AS (
  SELECT 
    c.id, c.manual_id, c.content, c.page_start, c.page_end, c.menu_path,
    ts_rank(to_tsvector('english', c.content), phraseto_tsquery('english', query_text)) AS score,
    'text'::text as content_type
  FROM chunks_text c
  WHERE to_tsvector('english', c.content) @@ phraseto_tsquery('english', query_text)
    AND (manual IS NULL OR c.manual_id = manual)
    AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
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
    AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
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
    AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
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
LIMIT top_k;
$$;