-- Create queue table for pending chunks
CREATE TABLE IF NOT EXISTS manual_chunk_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | done | failed
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index to prevent duplicate chunks
CREATE UNIQUE INDEX IF NOT EXISTS manual_chunk_queue_unique
  ON manual_chunk_queue (manual_id, chunk_id);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS manual_chunk_queue_status_idx
  ON manual_chunk_queue (manual_id, status, chunk_index);