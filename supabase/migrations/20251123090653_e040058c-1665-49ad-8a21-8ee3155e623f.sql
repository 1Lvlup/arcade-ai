-- Add SMS opt-in fields to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_in_date timestamptz,
  ADD COLUMN IF NOT EXISTS sms_opt_out_date timestamptz;

-- Create index for quick lookups by phone number
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone_number);