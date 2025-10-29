-- Add weekly query limit to usage_limits table
ALTER TABLE public.usage_limits 
ADD COLUMN queries_per_week INTEGER NOT NULL DEFAULT 300;

-- Create table for IP-based rate limiting (anonymous users)
CREATE TABLE IF NOT EXISTS public.ip_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  queries_count INTEGER NOT NULL DEFAULT 0,
  last_query_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  week_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT DATE_TRUNC('week', NOW()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create unique index on IP address
CREATE UNIQUE INDEX idx_ip_rate_limits_ip ON public.ip_rate_limits(ip_address);

-- Create index on week_start for efficient cleanup
CREATE INDEX idx_ip_rate_limits_week_start ON public.ip_rate_limits(week_start);

-- Enable RLS on ip_rate_limits
ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;

-- No SELECT policy needed - edge functions use service role
-- Add trigger for updated_at
CREATE TRIGGER update_ip_rate_limits_updated_at
  BEFORE UPDATE ON public.ip_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add weekly tracking to usage_limits
ALTER TABLE public.usage_limits
ADD COLUMN queries_used_this_week INTEGER NOT NULL DEFAULT 0,
ADD COLUMN week_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT DATE_TRUNC('week', NOW());

-- Function to reset weekly counters for usage_limits
CREATE OR REPLACE FUNCTION public.reset_weekly_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset authenticated user weekly counters if week has changed
  UPDATE public.usage_limits
  SET queries_used_this_week = 0,
      week_start = DATE_TRUNC('week', NOW())
  WHERE week_start < DATE_TRUNC('week', NOW());
  
  -- Clean up old IP rate limit records (older than 1 week)
  DELETE FROM public.ip_rate_limits
  WHERE week_start < DATE_TRUNC('week', NOW()) - INTERVAL '1 week';
END;
$$;

-- Function to increment IP-based query count
CREATE OR REPLACE FUNCTION public.increment_ip_query_count(p_ip_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_week TIMESTAMP WITH TIME ZONE := DATE_TRUNC('week', NOW());
  v_queries_count INTEGER;
  v_limit INTEGER := 5; -- Free tier limit
BEGIN
  -- Insert or update IP record
  INSERT INTO public.ip_rate_limits (ip_address, queries_count, last_query_at, week_start)
  VALUES (p_ip_address, 1, NOW(), v_current_week)
  ON CONFLICT (ip_address) DO UPDATE
  SET queries_count = CASE
    WHEN ip_rate_limits.week_start < v_current_week THEN 1
    ELSE ip_rate_limits.queries_count + 1
  END,
  last_query_at = NOW(),
  week_start = v_current_week,
  updated_at = NOW()
  RETURNING queries_count INTO v_queries_count;
  
  RETURN jsonb_build_object(
    'queries_used', v_queries_count,
    'queries_remaining', GREATEST(0, v_limit - v_queries_count),
    'limit_reached', v_queries_count >= v_limit
  );
END;
$$;

-- Function to increment authenticated user query count
CREATE OR REPLACE FUNCTION public.increment_user_query_count(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_week TIMESTAMP WITH TIME ZONE := DATE_TRUNC('week', NOW());
  v_queries_used INTEGER;
  v_queries_limit INTEGER;
  v_manual_override BOOLEAN;
BEGIN
  -- Update and get current usage
  UPDATE public.usage_limits
  SET queries_used_this_week = CASE
    WHEN week_start < v_current_week THEN 1
    ELSE queries_used_this_week + 1
  END,
  week_start = v_current_week,
  updated_at = NOW()
  WHERE fec_tenant_id = p_tenant_id
  RETURNING queries_used_this_week, queries_per_week, manual_override
  INTO v_queries_used, v_queries_limit, v_manual_override;
  
  -- If manual override is enabled, return unlimited
  IF v_manual_override THEN
    RETURN jsonb_build_object(
      'queries_used', v_queries_used,
      'queries_remaining', 999999,
      'queries_limit', v_queries_limit,
      'limit_reached', false,
      'manual_override', true
    );
  END IF;
  
  RETURN jsonb_build_object(
    'queries_used', v_queries_used,
    'queries_remaining', GREATEST(0, v_queries_limit - v_queries_used),
    'queries_limit', v_queries_limit,
    'limit_reached', v_queries_used >= v_queries_limit,
    'manual_override', false
  );
END;
$$;