-- Fix text search function to be more flexible with search terms
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
SELECT 
  c.id,
  c.manual_id,
  c.content,
  c.page_start,
  c.page_end,
  c.menu_path,
  ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) AS score,
  'text'::text as content_type
FROM chunks_text c
WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', query_text)
  AND (manual IS NULL OR c.manual_id = manual)
  AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
ORDER BY score DESC
LIMIT top_k;
$$;