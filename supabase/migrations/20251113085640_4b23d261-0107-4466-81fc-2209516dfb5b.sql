-- Add signup fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS facility_name TEXT,
ADD COLUMN IF NOT EXISTS total_games INTEGER,
ADD COLUMN IF NOT EXISTS position TEXT;