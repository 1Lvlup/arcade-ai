-- Create tenant_manual_access table to control which tenants can access which manuals
CREATE TABLE public.tenant_manual_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fec_tenant_id UUID NOT NULL REFERENCES public.fec_tenants(id) ON DELETE CASCADE,
  manual_id TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fec_tenant_id, manual_id)
);

-- Enable RLS on the new table
ALTER TABLE public.tenant_manual_access ENABLE ROW LEVEL SECURITY;

-- Admins can manage all tenant manual access
CREATE POLICY "Admins can manage tenant manual access"
ON public.tenant_manual_access
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own tenant's manual access
CREATE POLICY "Users can view their tenant manual access"
ON public.tenant_manual_access
FOR SELECT
TO authenticated
USING (fec_tenant_id = get_current_user_fec_tenant_id());

-- Update the handle_new_user function to create a unique tenant per user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- Create a new tenant for this user
  INSERT INTO public.fec_tenants (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  )
  RETURNING id INTO new_tenant_id;
  
  -- Create profile linked to the new tenant
  INSERT INTO public.profiles (user_id, fec_tenant_id, email)
  VALUES (NEW.id, new_tenant_id, NEW.email);
  
  RETURN NEW;
END;
$$;

-- Add index for performance
CREATE INDEX idx_tenant_manual_access_tenant ON public.tenant_manual_access(fec_tenant_id);
CREATE INDEX idx_tenant_manual_access_manual ON public.tenant_manual_access(manual_id);

-- Update documents RLS to check manual access for non-admins
DROP POLICY IF EXISTS "Users can view documents for their FEC only" ON public.documents;
CREATE POLICY "Users can view documents for their FEC only"
ON public.documents
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (
    fec_tenant_id = get_current_user_fec_tenant_id() AND
    manual_id IN (
      SELECT manual_id FROM public.tenant_manual_access
      WHERE fec_tenant_id = get_current_user_fec_tenant_id()
    )
  )
);

-- Update chunks_text RLS to check manual access
DROP POLICY IF EXISTS "Users can view chunks for their FEC only" ON public.chunks_text;
CREATE POLICY "Users can view chunks for their FEC only"
ON public.chunks_text
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (
    fec_tenant_id = get_current_user_fec_tenant_id() AND
    manual_id IN (
      SELECT manual_id FROM public.tenant_manual_access
      WHERE fec_tenant_id = get_current_user_fec_tenant_id()
    )
  )
);

-- Update manual_metadata RLS to check manual access
DROP POLICY IF EXISTS "Users can view manual metadata for their FEC" ON public.manual_metadata;
CREATE POLICY "Users can view manual metadata for their FEC"
ON public.manual_metadata
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  manual_id IN (
    SELECT tma.manual_id 
    FROM public.tenant_manual_access tma
    WHERE tma.fec_tenant_id = get_current_user_fec_tenant_id()
  )
);

-- Update figures RLS to check manual access
DROP POLICY IF EXISTS "Users can view figures for their FEC only" ON public.figures;
CREATE POLICY "Users can view figures for their FEC only"
ON public.figures
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (
    fec_tenant_id = get_current_user_fec_tenant_id() AND
    manual_id IN (
      SELECT manual_id FROM public.tenant_manual_access
      WHERE fec_tenant_id = get_current_user_fec_tenant_id()
    )
  )
);