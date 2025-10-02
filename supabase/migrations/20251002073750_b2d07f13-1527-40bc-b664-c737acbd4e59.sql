-- Add explanation column to golden_questions table
ALTER TABLE golden_questions 
ADD COLUMN IF NOT EXISTS explanation TEXT;