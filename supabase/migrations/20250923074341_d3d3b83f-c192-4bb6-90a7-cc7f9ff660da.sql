-- Add simple search function for fallback when embeddings fail
CREATE OR REPLACE FUNCTION public.simple_search(
  search_query text,
  search_manual text DEFAULT NULL,
  search_tenant uuid DEFAULT NULL,
  search_limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  manual_id text,
  content text,
  page_start integer,
  page_end integer,
  menu_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT 
    c.id,
    c.manual_id,
    c.content,
    c.page_start,
    c.page_end,
    c.menu_path
  FROM chunks_text c
  WHERE 
    c.content ILIKE '%' || search_query || '%'
    AND (search_manual IS NULL OR c.manual_id = search_manual)
    AND (search_tenant IS NULL OR c.fec_tenant_id = search_tenant)
  ORDER BY 
    -- Prioritize shorter content (more focused results)
    length(c.content) ASC,
    -- Then by page order
    c.page_start ASC NULLS LAST
  LIMIT search_limit;
$function$;