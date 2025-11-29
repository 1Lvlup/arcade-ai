-- Create job progress tracker table
CREATE TABLE IF NOT EXISTS manual_processing_jobs (
  manual_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | completed | failed
  total_chunks INTEGER NOT NULL DEFAULT 0,
  processed_chunks INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE manual_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Service role can manage all jobs
CREATE POLICY "Service can manage processing jobs"
ON manual_processing_jobs
FOR ALL
USING (true)
WITH CHECK (true);

-- Admins can view processing jobs
CREATE POLICY "Admins can view processing jobs"
ON manual_processing_jobs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view processing jobs
CREATE POLICY "Users can view processing jobs"
ON manual_processing_jobs
FOR SELECT
USING (auth.uid() IS NOT NULL);