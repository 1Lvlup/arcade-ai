-- Add storage_path column to documents table to store the full path in storage
-- This allows proper deletion and regeneration of signed URLs
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN documents.storage_path IS 'Full storage path in the manuals bucket (e.g., user-id/filename.pdf)';