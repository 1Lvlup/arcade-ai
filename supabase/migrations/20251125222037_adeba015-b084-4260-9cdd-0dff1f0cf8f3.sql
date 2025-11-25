-- Remove automatic admin assignment from handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- Create a unique tenant for this user
  INSERT INTO public.fec_tenants (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'facility_name', 'My Facility'),
    NEW.email
  )
  RETURNING id INTO new_tenant_id;

  -- Create profile with metadata from signup
  INSERT INTO public.profiles (
    user_id, 
    fec_tenant_id, 
    email,
    facility_name,
    total_games,
    position,
    bio
  )
  VALUES (
    NEW.id,
    new_tenant_id,
    NEW.email,
    NEW.raw_user_meta_data->>'facility_name',
    NULLIF(NEW.raw_user_meta_data->>'total_games', '')::integer,
    NEW.raw_user_meta_data->>'position',
    NEW.raw_user_meta_data->>'experience'
  );

  -- REMOVED: Automatic admin role assignment
  -- New users will NOT automatically become admins
  -- Admins must manually promote users via the admin panel

  -- Grant access to ALL existing manuals
  INSERT INTO public.tenant_manual_access (fec_tenant_id, manual_id, granted_by)
  SELECT 
    new_tenant_id,
    manual_id,
    NULL
  FROM public.manual_metadata;

  RETURN NEW;
END;
$function$;