-- Add job_id column to figures table for image serving
ALTER TABLE public.figures ADD COLUMN IF NOT EXISTS job_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS figures_job_id_idx ON public.figures(job_id);