-- Add metadata column to manual_chunk_queue for storing chunk metadata
ALTER TABLE manual_chunk_queue
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;