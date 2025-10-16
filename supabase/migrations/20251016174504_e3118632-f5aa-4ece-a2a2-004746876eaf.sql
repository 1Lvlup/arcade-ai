-- Make user_id nullable and set default to auth.uid()
ALTER TABLE model_feedback 
ALTER COLUMN user_id SET DEFAULT auth.uid(),
ALTER COLUMN user_id DROP NOT NULL;