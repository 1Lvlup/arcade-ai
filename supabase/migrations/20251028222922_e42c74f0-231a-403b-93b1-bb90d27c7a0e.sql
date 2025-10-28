-- Add manual access override to usage_limits table
ALTER TABLE public.usage_limits 
ADD COLUMN IF NOT EXISTS manual_override boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS override_reason text,
ADD COLUMN IF NOT EXISTS override_set_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS override_set_at timestamp with time zone;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_usage_limits_manual_override ON public.usage_limits(manual_override) WHERE manual_override = true;

-- Add comment to document the column
COMMENT ON COLUMN public.usage_limits.manual_override IS 'When true, user has unlimited access regardless of subscription status';
COMMENT ON COLUMN public.usage_limits.override_reason IS 'Admin note explaining why manual override was granted';
COMMENT ON COLUMN public.usage_limits.override_set_by IS 'User ID of admin who set the override';
COMMENT ON COLUMN public.usage_limits.override_set_at IS 'Timestamp when override was set';