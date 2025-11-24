-- Ensure the admin role exists for the site owner
-- Replace 'your-email@example.com' with your actual email address

DO $$
DECLARE
  owner_user_id uuid;
BEGIN
  -- Get the user ID for the owner (you'll need to replace the email)
  SELECT id INTO owner_user_id
  FROM auth.users
  WHERE email = 'your-email@example.com'
  LIMIT 1;

  -- Only proceed if user exists
  IF owner_user_id IS NOT NULL THEN
    -- Insert admin role if it doesn't exist
    INSERT INTO public.user_roles (user_id, role)
    VALUES (owner_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role granted to user: %', owner_user_id;
  ELSE
    RAISE NOTICE 'User not found with that email. Please update the email in the migration.';
  END IF;
END $$;

-- Create a helpful function to check your admin status
CREATE OR REPLACE FUNCTION public.check_my_admin_status()
RETURNS TABLE (
  user_email text,
  has_admin_role boolean,
  all_roles text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    au.email,
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    ) as has_admin_role,
    ARRAY_AGG(ur.role::text) as all_roles
  FROM auth.users au
  LEFT JOIN user_roles ur ON ur.user_id = au.id
  WHERE au.id = auth.uid()
  GROUP BY au.email;
$$;