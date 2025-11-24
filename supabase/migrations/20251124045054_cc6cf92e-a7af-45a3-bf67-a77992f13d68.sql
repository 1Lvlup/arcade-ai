-- Create guest_usage_limits table for IP-based free tier tracking
CREATE TABLE IF NOT EXISTS public.guest_usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL UNIQUE,
  queries_used_this_month INTEGER NOT NULL DEFAULT 0,
  queries_per_month INTEGER NOT NULL DEFAULT 5,
  last_query_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  month_start TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('month', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guest_usage_ip_hash ON public.guest_usage_limits(ip_hash);
CREATE INDEX IF NOT EXISTS idx_guest_usage_month_start ON public.guest_usage_limits(month_start);

-- Function to increment guest usage
CREATE OR REPLACE FUNCTION public.increment_guest_query_count(p_ip_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_month TIMESTAMP WITH TIME ZONE := DATE_TRUNC('month', NOW());
  v_queries_used INTEGER;
  v_queries_limit INTEGER := 5;
BEGIN
  -- Insert or update guest usage record
  INSERT INTO public.guest_usage_limits (ip_hash, queries_used_this_month, last_query_at, month_start)
  VALUES (p_ip_hash, 1, NOW(), v_current_month)
  ON CONFLICT (ip_hash) DO UPDATE
  SET queries_used_this_month = CASE
    WHEN guest_usage_limits.month_start < v_current_month THEN 1
    ELSE guest_usage_limits.queries_used_this_month + 1
  END,
  last_query_at = NOW(),
  month_start = v_current_month,
  updated_at = NOW()
  RETURNING queries_used_this_month INTO v_queries_used;
  
  RETURN jsonb_build_object(
    'queries_used', v_queries_used,
    'queries_remaining', GREATEST(0, v_queries_limit - v_queries_used),
    'queries_limit', v_queries_limit,
    'limit_reached', v_queries_used >= v_queries_limit,
    'is_authenticated', false
  );
END;
$$;

-- Update usage_limits defaults for new free tier users
ALTER TABLE public.usage_limits 
  ALTER COLUMN queries_per_month SET DEFAULT 5,
  ALTER COLUMN queries_per_week SET DEFAULT 5;

-- Add column to track if user has ever been subscribed (for analytics)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS has_ever_subscribed BOOLEAN DEFAULT FALSE;

COMMENT ON TABLE public.guest_usage_limits IS 'Tracks query usage for unauthenticated users by IP hash';
COMMENT ON FUNCTION public.increment_guest_query_count IS 'Increments and returns usage info for guest users (5 queries/month)';