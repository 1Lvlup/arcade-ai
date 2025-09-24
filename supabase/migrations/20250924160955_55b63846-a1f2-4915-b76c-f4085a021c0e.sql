-- Add vision_text column to store OpenAI vision analysis results
ALTER TABLE public.figures 
ADD COLUMN vision_text text;