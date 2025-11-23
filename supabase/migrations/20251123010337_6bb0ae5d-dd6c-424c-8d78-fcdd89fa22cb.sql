
-- Remove admin role from all users except jdupre@kingpinz.com and hciv13@gmail.com
DELETE FROM public.user_roles
WHERE role = 'admin'
AND user_id NOT IN (
  SELECT id FROM auth.users 
  WHERE email IN ('jdupre@kingpinz.com', 'hciv13@gmail.com')
);
