-- Update docs table to include fec_tenant_id for multi-tenant isolation
ALTER TABLE public.docs ADD COLUMN fec_tenant_id UUID REFERENCES public.fec_tenants(id) ON DELETE CASCADE;

-- Enable RLS on docs table (if not already enabled)
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on rag_chunks table
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user's FEC tenant ID
CREATE OR REPLACE FUNCTION public.get_current_user_fec_tenant_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT fec_tenant_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Create RLS policies for fec_tenants
CREATE POLICY "Users can view their own FEC tenant" 
ON public.fec_tenants 
FOR SELECT 
USING (id = public.get_current_user_fec_tenant_id());

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create RLS policies for docs (multi-tenant isolation)
CREATE POLICY "Users can view docs for their FEC only" 
ON public.docs 
FOR SELECT 
USING (fec_tenant_id = public.get_current_user_fec_tenant_id());

CREATE POLICY "Users can insert docs for their FEC only" 
ON public.docs 
FOR INSERT 
WITH CHECK (fec_tenant_id = public.get_current_user_fec_tenant_id());

-- Create RLS policies for rag_chunks (allow all authenticated users for now)
CREATE POLICY "Authenticated users can view rag_chunks" 
ON public.rag_chunks 
FOR SELECT 
TO authenticated 
USING (true);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, fec_tenant_id, email)
  VALUES (
    NEW.id, 
    (NEW.raw_user_meta_data->>'fec_tenant_id')::UUID,
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_fec_tenants_updated_at
  BEFORE UPDATE ON public.fec_tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();