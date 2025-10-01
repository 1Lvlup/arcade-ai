-- Fix missing profile for existing user
-- This will allow the RLS policies to work correctly and show chunk counts

INSERT INTO profiles (user_id, fec_tenant_id, email)
SELECT 
  id,
  '00000000-0000-0000-0000-000000000001'::uuid as fec_tenant_id,
  email
FROM auth.users
WHERE id = '42722880-f6e1-4e08-9137-363b2b3d4a7e'
ON CONFLICT (user_id) DO UPDATE
  SET fec_tenant_id = EXCLUDED.fec_tenant_id,
      email = EXCLUDED.email;