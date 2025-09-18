-- Create a default FEC tenant for MVP
INSERT INTO public.fec_tenants (id, name, email) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Default MVP FEC', 'admin@arcadefixguru.com')
ON CONFLICT (id) DO NOTHING;

-- Update the handle_new_user function to automatically assign users to the default FEC
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, fec_tenant_id, email)
  VALUES (
    NEW.id, 
    '00000000-0000-0000-0000-000000000001'::UUID, -- Use default FEC tenant
    NEW.email
  );
  RETURN NEW;
END;
$function$;