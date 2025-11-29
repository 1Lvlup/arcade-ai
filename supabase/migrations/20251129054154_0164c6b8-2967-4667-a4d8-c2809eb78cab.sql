-- Add unique index on chunks_text(manual_id, chunk_id) to enable proper upsert conflict resolution
-- This prevents duplicate chunks from being created when webhooks retry
CREATE UNIQUE INDEX IF NOT EXISTS chunks_text_manual_chunk_unique 
ON chunks_text(manual_id, chunk_id);