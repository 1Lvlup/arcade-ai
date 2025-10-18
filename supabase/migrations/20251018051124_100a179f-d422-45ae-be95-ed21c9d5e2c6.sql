-- Phase 1A: Expand chunks_text table with comprehensive metadata
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS chunk_id TEXT;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS doc_id TEXT;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS doc_version TEXT DEFAULT 'v1';
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS start_char INTEGER;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS end_char INTEGER;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS chunk_hash TEXT;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small';
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS section_heading TEXT;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS semantic_tags TEXT[];
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS entities JSONB;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS source_filename TEXT;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS ingest_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS quality_score NUMERIC;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS human_reviewed BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Create indexes for new searchable fields
CREATE INDEX IF NOT EXISTS chunks_semantic_tags_idx ON chunks_text USING GIN(semantic_tags);
CREATE INDEX IF NOT EXISTS chunks_entities_idx ON chunks_text USING GIN(entities);
CREATE INDEX IF NOT EXISTS chunks_quality_idx ON chunks_text(quality_score);
CREATE INDEX IF NOT EXISTS chunks_chunk_id_idx ON chunks_text(chunk_id);
CREATE INDEX IF NOT EXISTS chunks_doc_id_idx ON chunks_text(doc_id);

-- Phase 1B: Expand figures table with comprehensive metadata
ALTER TABLE figures ADD COLUMN IF NOT EXISTS doc_id TEXT;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS figure_type TEXT;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS image_hash TEXT;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS detected_components JSONB;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS verified_by_human UUID;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS vision_metadata JSONB;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS semantic_tags TEXT[];
ALTER TABLE figures ADD COLUMN IF NOT EXISTS entities JSONB;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS quality_score NUMERIC;

-- Create indexes for figures
CREATE INDEX IF NOT EXISTS figures_type_idx ON figures(figure_type);
CREATE INDEX IF NOT EXISTS figures_components_idx ON figures USING GIN(detected_components);
CREATE INDEX IF NOT EXISTS figures_tags_idx ON figures USING GIN(semantic_tags);
CREATE INDEX IF NOT EXISTS figures_entities_idx ON figures USING GIN(entities);
CREATE INDEX IF NOT EXISTS figures_doc_id_idx ON figures(doc_id);
CREATE INDEX IF NOT EXISTS figures_quality_idx ON figures(quality_score);

-- Phase 5: Create page_label_map table for automatic page detection
CREATE TABLE IF NOT EXISTS page_label_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id TEXT NOT NULL,
  sequential_page INTEGER NOT NULL,
  actual_page_label TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.9,
  detection_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manual_id, sequential_page)
);

CREATE INDEX IF NOT EXISTS page_label_map_manual_idx ON page_label_map(manual_id);

-- Phase 7: Usage tracking trigger for chunks
CREATE OR REPLACE FUNCTION increment_chunk_usage()
RETURNS TRIGGER AS $$
DECLARE
  chunk_ids UUID[];
BEGIN
  -- Extract chunk IDs from top_doc_ids array if they exist
  IF NEW.top_doc_ids IS NOT NULL THEN
    chunk_ids := NEW.top_doc_ids;
    
    -- Increment usage_count for each chunk
    UPDATE chunks_text 
    SET usage_count = usage_count + 1
    WHERE id = ANY(chunk_ids);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on query_logs
DROP TRIGGER IF EXISTS track_chunk_usage ON query_logs;
CREATE TRIGGER track_chunk_usage
AFTER INSERT ON query_logs
FOR EACH ROW
EXECUTE FUNCTION increment_chunk_usage();