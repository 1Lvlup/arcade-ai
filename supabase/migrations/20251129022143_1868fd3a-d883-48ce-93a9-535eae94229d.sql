-- Function to lock a batch of pending chunks for processing
CREATE OR REPLACE FUNCTION manual_chunk_queue_lock_batch(
  p_manual_id TEXT,
  p_limit INTEGER
)
RETURNS SETOF manual_chunk_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM manual_chunk_queue
    WHERE manual_id = p_manual_id
      AND status = 'pending'
    ORDER BY chunk_index
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE manual_chunk_queue q
  SET status = 'processing',
      updated_at = now()
  FROM cte
  WHERE q.id = cte.id
  RETURNING q.*;
END;
$$;

-- Function to increment processed chunks count
CREATE OR REPLACE FUNCTION increment_processed_chunks(
  p_manual_id TEXT,
  p_increment INTEGER
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE manual_processing_jobs
  SET processed_chunks = processed_chunks + p_increment,
      updated_at = now()
  WHERE manual_id = p_manual_id;
$$;

-- Function to increment retry count for a queue item
CREATE OR REPLACE FUNCTION manual_chunk_queue_increment_retry(
  p_queue_id UUID
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE manual_chunk_queue
  SET retry_count = retry_count + 1,
      updated_at = now()
  WHERE id = p_queue_id;
$$;