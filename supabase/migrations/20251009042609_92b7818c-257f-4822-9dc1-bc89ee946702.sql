-- Fix critical security issues: Enable RLS on manual_pages, drop public policy on rag_chunks, and create role-based access control

-- 1. Enable RLS on manual_pages table
ALTER TABLE manual_pages ENABLE ROW LEVEL SECURITY;

-- 2. Add tenant-scoped policies for manual_pages
CREATE POLICY "Users can view manual pages for their FEC only"
ON manual_pages FOR SELECT
USING (manual_id IN (
  SELECT manual_id FROM documents 
  WHERE fec_tenant_id = get_current_user_fec_tenant_id()
));

CREATE POLICY "svc select manual_pages"
ON manual_pages FOR SELECT
USING (manual_id IN (
  SELECT manual_id FROM documents 
  WHERE fec_tenant_id = get_current_tenant_context()
));

CREATE POLICY "svc insert manual_pages"
ON manual_pages FOR INSERT
WITH CHECK (manual_id IN (
  SELECT manual_id FROM documents 
  WHERE fec_tenant_id = get_current_tenant_context()
));

CREATE POLICY "svc update manual_pages"
ON manual_pages FOR UPDATE
USING (manual_id IN (
  SELECT manual_id FROM documents 
  WHERE fec_tenant_id = get_current_tenant_context()
))
WITH CHECK (manual_id IN (
  SELECT manual_id FROM documents 
  WHERE fec_tenant_id = get_current_tenant_context()
));

-- 3. Drop the public read policy on rag_chunks
DROP POLICY IF EXISTS "read_chunks" ON rag_chunks;

-- 4. Create user roles table for proper RBAC
CREATE TYPE app_role AS ENUM ('admin', 'user', 'viewer');

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  fec_tenant_id UUID REFERENCES fec_tenants(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role, fec_tenant_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 6. Add RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON user_roles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
ON user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- 7. Insert initial admin role for existing admin user
INSERT INTO user_roles (user_id, role, fec_tenant_id)
SELECT 
  au.id,
  'admin'::app_role,
  p.fec_tenant_id
FROM auth.users au
JOIN profiles p ON p.user_id = au.id
WHERE au.email = 'jdupre@kingpinz.com'
ON CONFLICT (user_id, role, fec_tenant_id) DO NOTHING;