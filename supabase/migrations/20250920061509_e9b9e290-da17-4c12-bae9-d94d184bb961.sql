-- Fix vector search function to accept float8[] and cast internally
-- This resolves the PostgREST type coercion issue with JavaScript arrays

CREATE OR REPLACE FUNCTION public.match_chunks_improved(
  query_embedding float8[],         -- Accept float array from JavaScript
  top_k           int     DEFAULT 12,
  min_score       float   DEFAULT 0.30,
  manual          text    DEFAULT NULL,
  tenant_id       uuid    DEFAULT NULL
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
WITH q AS (
  SELECT query_embedding::vector(1536) AS qvec  -- Cast to vector internally
)
SELECT
  c.id,
  c.manual_id,
  c.content,
  c.page_start,
  c.page_end,
  c.menu_path,
  1 - (c.embedding <=> (SELECT qvec FROM q)) AS score,
  'text'::text AS content_type
FROM chunks_text c
WHERE
  (tenant_id IS NULL OR c.fec_tenant_id = tenant_id)
  AND (manual IS NULL OR c.manual_id = manual)
  AND c.embedding IS NOT NULL
  AND (1 - (c.embedding <=> (SELECT qvec FROM q))) >= min_score
ORDER BY c.embedding <=> (SELECT qvec FROM q)
LIMIT top_k;
$$;

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure proper index exists for cosine similarity
CREATE INDEX IF NOT EXISTS chunks_text_embedding_cosine_idx
  ON chunks_text USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ANALYZE chunks_text;