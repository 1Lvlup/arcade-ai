-- Fix search path security issues for existing functions
CREATE OR REPLACE FUNCTION public.search_manual_content(
  query_embedding VECTOR(1536),
  search_manual_id TEXT DEFAULT NULL,
  match_count INTEGER DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  manual_id TEXT,
  page_start INTEGER,
  page_end INTEGER,
  menu_path TEXT,
  similarity FLOAT,
  content_type TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT 
    c.id,
    c.content,
    c.manual_id,
    c.page_start,
    c.page_end,
    c.menu_path,
    1 - (c.embedding <=> query_embedding) as similarity,
    'text'::text as content_type
  FROM public.chunks_text c
  WHERE (search_manual_id IS NULL OR c.manual_id = search_manual_id)
    AND c.fec_tenant_id = get_current_user_fec_tenant_id()
    AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
  
  UNION ALL
  
  SELECT 
    f.id,
    COALESCE(f.caption_text, '') || ' ' || COALESCE(f.ocr_text, '') as content,
    f.manual_id,
    f.page_number as page_start,
    f.page_number as page_end,
    NULL as menu_path,
    1 - (f.embedding_text <=> query_embedding) as similarity,
    'figure'::text as content_type
  FROM public.figures f
  WHERE (search_manual_id IS NULL OR f.manual_id = search_manual_id)
    AND f.fec_tenant_id = get_current_user_fec_tenant_id()
    AND f.embedding_text IS NOT NULL
    AND (1 - (f.embedding_text <=> query_embedding)) >= similarity_threshold
  
  ORDER BY similarity DESC
  LIMIT match_count;
$function$;

-- Fix other functions with search path issues
CREATE OR REPLACE FUNCTION public.get_current_user_fec_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT fec_tenant_id FROM public.profiles WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding extensions.vector, match_count integer DEFAULT 6, match_threshold double precision DEFAULT 0.0, game text DEFAULT NULL::text)
RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  select
    d.id,
    d.content,
    jsonb_build_object(
      'game_title', d.game_title,
      'manual_section', d.manual_section,
      'subsection', d.subsection,
      'page_ranges', d.page_ranges,
      'source_file', d.source_file
    ) as metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from docs d
  where (game is null or d.game_title = game)
    and (1 - (d.embedding <=> query_embedding)) >= match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$function$;