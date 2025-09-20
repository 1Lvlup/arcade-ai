-- Create improved search RPC functions with adjustable thresholds

-- 1) Ensure cosine index exists for better performance
CREATE INDEX IF NOT EXISTS chunks_text_embedding_idx
ON chunks_text USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ANALYZE chunks_text;

-- 2) Create improved vector search function with adjustable threshold
CREATE OR REPLACE FUNCTION public.match_chunks_improved(
  query_embedding vector(1536),
  top_k INT DEFAULT 12,
  min_score FLOAT DEFAULT 0.30,
  manual TEXT DEFAULT NULL,
  tenant_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  manual_id TEXT,
  content TEXT,
  page_start INTEGER,
  page_end INTEGER,
  menu_path TEXT,
  score FLOAT,
  content_type TEXT
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
  1 - (c.embedding <=> query_embedding) AS score,
  'text'::text as content_type
FROM chunks_text c
WHERE (manual IS NULL OR c.manual_id = manual)
  AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
  AND c.embedding IS NOT NULL
  AND (1 - (c.embedding <=> query_embedding)) >= min_score
ORDER BY c.embedding <=> query_embedding
LIMIT top_k
$$;

-- 3) Create text-based search function for hybrid fallback
CREATE OR REPLACE FUNCTION public.match_chunks_text(
  query_text TEXT,
  top_k INT DEFAULT 12,
  manual TEXT DEFAULT NULL,
  tenant_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  manual_id TEXT,
  content TEXT,
  page_start INTEGER,
  page_end INTEGER,
  menu_path TEXT,
  score FLOAT,
  content_type TEXT
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
  ts_rank(to_tsvector('english', c.content), websearch_to_tsquery(query_text)) AS score,
  'text'::text as content_type
FROM chunks_text c
WHERE to_tsvector('english', c.content) @@ websearch_to_tsquery(query_text)
  AND (manual IS NULL OR c.manual_id = manual)
  AND (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
ORDER BY score DESC
LIMIT top_k
$$;