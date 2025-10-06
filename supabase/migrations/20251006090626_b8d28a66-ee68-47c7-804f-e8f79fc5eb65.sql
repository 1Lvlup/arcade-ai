-- Update figures table to use storage path instead of LlamaCloud URL
ALTER TABLE figures 
  DROP COLUMN IF EXISTS image_url,
  ADD COLUMN storage_path text;

-- Add index for faster lookups by manual_id and storage_path
CREATE INDEX IF NOT EXISTS idx_figures_manual_storage 
  ON figures(manual_id, storage_path);