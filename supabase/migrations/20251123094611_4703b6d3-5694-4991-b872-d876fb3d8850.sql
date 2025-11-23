-- Create SMS configuration table
CREATE TABLE IF NOT EXISTS public.sms_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fec_tenant_id UUID NOT NULL REFERENCES public.fec_tenants(id) ON DELETE CASCADE,
  welcome_message_enabled BOOLEAN DEFAULT true,
  welcome_message_template TEXT DEFAULT 'Welcome to LevelUp AI! 🎮

I''m your 24/7 arcade tech assistant. Text me questions about any game issue and I''ll help you troubleshoot.

Examples:
• "Claw machine not grabbing"
• "Air hockey puck stuck"
• "Redemption kiosk error code"

Reply STOP to unsubscribe, START to resubscribe.',
  example_questions TEXT[] DEFAULT ARRAY[
    'Claw machine not grabbing',
    'Air hockey puck stuck',
    'Redemption kiosk error code',
    'Basketball game not counting points'
  ],
  auto_send_on_first_message BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER update_sms_config_updated_at
  BEFORE UPDATE ON public.sms_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.sms_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their tenant's SMS config"
  ON public.sms_config FOR SELECT
  USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Admins can update their tenant's SMS config"
  ON public.sms_config FOR UPDATE
  USING (
    fec_tenant_id = get_current_user_fec_tenant_id() 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can insert their tenant's SMS config"
  ON public.sms_config FOR INSERT
  WITH CHECK (
    fec_tenant_id = get_current_user_fec_tenant_id() 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Create default config for existing tenants
INSERT INTO public.sms_config (fec_tenant_id)
SELECT id FROM public.fec_tenants
ON CONFLICT DO NOTHING;