-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can create their own tickets
CREATE POLICY "Users can create their own tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id AND fec_tenant_id = get_current_user_fec_tenant_id());

-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
ON public.support_tickets
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update tickets
CREATE POLICY "Admins can update tickets"
ON public.support_tickets
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create usage limits table
CREATE TABLE public.usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fec_tenant_id UUID NOT NULL UNIQUE,
  queries_per_month INTEGER NOT NULL DEFAULT 1000,
  queries_used_this_month INTEGER NOT NULL DEFAULT 0,
  last_reset_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view their own usage"
ON public.usage_limits
FOR SELECT
USING (fec_tenant_id = get_current_user_fec_tenant_id());

-- Service can manage usage
CREATE POLICY "Service can manage usage"
ON public.usage_limits
FOR ALL
USING (fec_tenant_id = get_current_tenant_context())
WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- Admins can view all usage
CREATE POLICY "Admins can view all usage"
ON public.usage_limits
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update limits
CREATE POLICY "Admins can update limits"
ON public.usage_limits
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to auto-create usage limits for new tenants
CREATE OR REPLACE FUNCTION public.handle_new_tenant_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usage_limits (fec_tenant_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.fec_tenants
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_tenant_usage();