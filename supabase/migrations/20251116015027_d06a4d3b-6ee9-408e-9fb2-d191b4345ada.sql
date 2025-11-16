
-- Grant admin role to hciv13@gmail.com
DO $$
BEGIN
  -- Check if the user already has the admin role
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = 'ca7b3928-b08e-488b-b196-7acab4873bc3'::uuid 
    AND role = 'admin'::app_role
  ) THEN
    -- Insert admin role
    INSERT INTO user_roles (user_id, fec_tenant_id, role)
    SELECT 
      'ca7b3928-b08e-488b-b196-7acab4873bc3'::uuid,
      p.fec_tenant_id,
      'admin'::app_role
    FROM profiles p
    WHERE p.user_id = 'ca7b3928-b08e-488b-b196-7acab4873bc3'::uuid;
  END IF;
END $$;
