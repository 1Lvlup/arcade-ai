-- Add new columns to down_games table for tracking parts and completed status
ALTER TABLE down_games 
ADD COLUMN IF NOT EXISTS parts_changed TEXT,
ADD COLUMN IF NOT EXISTS things_tried TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;