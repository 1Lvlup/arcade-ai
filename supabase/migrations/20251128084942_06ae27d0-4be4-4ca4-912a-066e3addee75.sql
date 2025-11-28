-- Add SMS game selection columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS sms_selected_manual_id text,
ADD COLUMN IF NOT EXISTS sms_selected_manual_title text;

-- Add comment for documentation
COMMENT ON COLUMN profiles.sms_selected_manual_id IS 'The manual_id of the game the user has selected for SMS troubleshooting';
COMMENT ON COLUMN profiles.sms_selected_manual_title IS 'The title of the game the user has selected for SMS troubleshooting (for display purposes)';