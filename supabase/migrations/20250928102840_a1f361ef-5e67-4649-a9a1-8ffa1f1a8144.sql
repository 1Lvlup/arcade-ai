-- Add llama_asset_name column to figures table for storing original Llama asset references
ALTER TABLE figures ADD COLUMN IF NOT EXISTS llama_asset_name text;