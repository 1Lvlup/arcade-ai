-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id TEXT UNIQUE NOT NULL,
  title TEXT,
  source_filename TEXT,
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for documents
CREATE POLICY "Users can view documents for their FEC only" 
ON public.documents 
FOR SELECT 
USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can insert documents for their FEC only" 
ON public.documents 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id());

-- Create chunks_text table
CREATE TABLE IF NOT EXISTS public.chunks_text (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id TEXT NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  menu_path TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on chunks_text
ALTER TABLE public.chunks_text ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for chunks_text
CREATE POLICY "Users can view chunks for their FEC only" 
ON public.chunks_text 
FOR SELECT 
USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can insert chunks for their FEC only" 
ON public.chunks_text 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id());

-- Create indexes for chunks_text
CREATE INDEX IF NOT EXISTS chunks_text_embedding_idx ON public.chunks_text USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_text_manual_idx ON public.chunks_text (manual_id);
CREATE INDEX IF NOT EXISTS chunks_text_fec_idx ON public.chunks_text (fec_tenant_id);

-- Create figures table
CREATE TABLE IF NOT EXISTS public.figures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id TEXT NOT NULL,
  page_number INTEGER,
  figure_id TEXT,
  image_url TEXT NOT NULL,
  caption_text TEXT,
  ocr_text TEXT,
  callouts_json JSONB,
  bbox_pdf_coords TEXT,
  keywords TEXT[],
  embedding_text VECTOR(1536),
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on figures
ALTER TABLE public.figures ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for figures
CREATE POLICY "Users can view figures for their FEC only" 
ON public.figures 
FOR SELECT 
USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can insert figures for their FEC only" 
ON public.figures 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id());

-- Create indexes for figures
CREATE INDEX IF NOT EXISTS figures_embedding_idx ON public.figures USING hnsw (embedding_text vector_cosine_ops);
CREATE INDEX IF NOT EXISTS figures_manual_idx ON public.figures (manual_id);
CREATE INDEX IF NOT EXISTS figures_fec_idx ON public.figures (fec_tenant_id);

-- Add foreign key constraints
ALTER TABLE public.chunks_text 
ADD CONSTRAINT chunks_text_manual_fkey 
FOREIGN KEY (manual_id) REFERENCES public.documents(manual_id) ON DELETE CASCADE;

ALTER TABLE public.figures 
ADD CONSTRAINT figures_manual_fkey 
FOREIGN KEY (manual_id) REFERENCES public.documents(manual_id) ON DELETE CASCADE;

-- Add triggers for updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function for manual search with embeddings
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