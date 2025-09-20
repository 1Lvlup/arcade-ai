-- Improve text search function to be more flexible with complex queries
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
-- Try multiple search strategies and combine results
WITH 
-- Strategy 1: All words must match (strict)
strict_search AS (
  SELECT 
    c.id, c.manual_id, c.content, c.page_start, c.page_end, c.menu_path,
    ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) AS score,
    'text'::text as content_type
  FROM chunks_text c
  WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', query_text)
    AND (manual IS NULL OR c.manual_id = manual)
    AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
),
-- Strategy 2: Any word can match (flexible)
flexible_search AS (
  SELECT 
    c.id, c.manual_id, c.content, c.page_start, c.page_end, c.menu_path,
    ts_rank(to_tsvector('english', c.content), tsquery('english', array_to_string(string_to_array(query_text, ' '), ' | '))) AS score,
    'text'::text as content_type
  FROM chunks_text c
  WHERE to_tsvector('english', c.content) @@ tsquery('english', array_to_string(string_to_array(query_text, ' '), ' | '))
    AND (manual IS NULL OR c.manual_id = manual)
    AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
),
-- Strategy 3: Similarity search for partial matches
similarity_search AS (
  SELECT 
    c.id, c.manual_id, c.content, c.page_start, c.page_end, c.menu_path,
    similarity(c.content, query_text) AS score,
    'text'::text as content_type
  FROM chunks_text c
  WHERE similarity(c.content, query_text) > 0.1
    AND (manual IS NULL OR c.manual_id = manual)
    AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
),
-- Combine all strategies
combined_results AS (
  SELECT *, 'strict' as strategy FROM strict_search
  UNION ALL
  SELECT *, 'flexible' as strategy FROM flexible_search  
  UNION ALL
  SELECT *, 'similarity' as strategy FROM similarity_search
)
-- Return deduplicated results, prioritizing better strategies
SELECT DISTINCT ON (id) 
  id, manual_id, content, page_start, page_end, menu_path, score, content_type
FROM combined_results
ORDER BY id, 
  CASE strategy 
    WHEN 'strict' THEN 1
    WHEN 'flexible' THEN 2 
    WHEN 'similarity' THEN 3
  END,
  score DESC
LIMIT top_k;
$$;