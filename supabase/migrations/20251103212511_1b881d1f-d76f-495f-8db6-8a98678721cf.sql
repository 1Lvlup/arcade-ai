-- Grant admin role to the current user
-- First check if the user_roles table exists and has the admin role already
DO $$
DECLARE
  v_user_id UUID;
  v_has_role BOOLEAN;
BEGIN
  -- Get your user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'jdupre@kingpinz.com';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email jdupre@kingpinz.com';
  END IF;
  
  -- Check if user already has admin role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND role = 'admin'::public.app_role
  ) INTO v_has_role;
  
  -- If not, grant admin role
  IF NOT v_has_role THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin'::public.app_role);
    RAISE NOTICE 'Admin role granted to user %', v_user_id;
  ELSE
    RAISE NOTICE 'User % already has admin role', v_user_id;
  END IF;
END $$;