-- Add job_id column to documents table to store LlamaCloud job identifier
ALTER TABLE public.documents 
ADD COLUMN job_id text;