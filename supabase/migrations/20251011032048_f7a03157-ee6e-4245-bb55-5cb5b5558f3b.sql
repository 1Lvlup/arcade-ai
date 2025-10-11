-- Add visibility flag to figures table
ALTER TABLE figures ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;

-- Add index for better query performance when filtering by visibility
CREATE INDEX IF NOT EXISTS idx_figures_visible ON figures(manual_id, is_visible) WHERE is_visible = true;