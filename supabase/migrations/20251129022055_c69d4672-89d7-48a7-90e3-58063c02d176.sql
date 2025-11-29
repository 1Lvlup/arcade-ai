-- Enable RLS on manual_chunk_queue
ALTER TABLE manual_chunk_queue ENABLE ROW LEVEL SECURITY;

-- Service role can manage all queue items
CREATE POLICY "Service can manage chunk queue"
ON manual_chunk_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Admins can view chunk queue for debugging
CREATE POLICY "Admins can view chunk queue"
ON manual_chunk_queue
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));