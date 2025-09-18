-- Create FEC (Family Entertainment Center) tenants table
CREATE TABLE public.fec_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on fec_tenants
ALTER TABLE public.fec_tenants ENABLE ROW LEVEL SECURITY;

-- Create user profiles table linked to FEC tenants
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fec_tenant_id UUID NOT NULL REFERENCES public.fec_tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Update docs table to include fec_tenant_id for multi-tenant isolation
ALTER TABLE public.docs ADD COLUMN fec_tenant_id UUID REFERENCES public.fec_tenants(id) ON DELETE CASCADE;

-- Enable RLS on docs table
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for fec_tenants
CREATE POLICY "FEC tenants can view their own data" 
ON public.fec_tenants 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.fec_tenant_id = fec_tenants.id
  )
);

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
USING (
  fec_tenant_id IN (
    SELECT profiles.fec_tenant_id 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert docs for their FEC only" 
ON public.docs 
FOR INSERT 
WITH CHECK (
  fec_tenant_id IN (
    SELECT profiles.fec_tenant_id 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
  )
);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_fec_tenants_updated_at
  BEFORE UPDATE ON public.fec_tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();