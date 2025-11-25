-- CRITICAL SECURITY FIX: Add RLS policies to prevent non-admins from accessing admin data

-- ============================================================================
-- PROFILES TABLE: Only admins can view all profiles, users can view their own
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all profiles across all tenants" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update any profile
CREATE POLICY "Admins can update all profiles"
ON profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- USAGE_LIMITS TABLE: Only admins can view/modify usage limits
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own usage" ON usage_limits;
DROP POLICY IF EXISTS "Users can view own usage" ON usage_limits;
DROP POLICY IF EXISTS "Admins can view all usage" ON usage_limits;
DROP POLICY IF EXISTS "Admins can update limits" ON usage_limits;
DROP POLICY IF EXISTS "Admins can update all usage" ON usage_limits;
DROP POLICY IF EXISTS "Admins can insert usage" ON usage_limits;

-- Users can view their own usage limits
CREATE POLICY "Users can view own usage"
ON usage_limits FOR SELECT
USING (fec_tenant_id = get_current_user_fec_tenant_id());

-- Admins can view all usage limits
CREATE POLICY "Admins can view all usage"
ON usage_limits FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update any usage limits
CREATE POLICY "Admins can update all usage"
ON usage_limits FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert usage limits
CREATE POLICY "Admins can insert usage"
ON usage_limits FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- FEC_TENANTS TABLE: Only admins can view all tenants
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own FEC tenant" ON fec_tenants;
DROP POLICY IF EXISTS "Users can view own tenant" ON fec_tenants;
DROP POLICY IF EXISTS "Admins can view all tenants" ON fec_tenants;
DROP POLICY IF EXISTS "Admins can update all tenants" ON fec_tenants;

-- Users can view their own tenant
CREATE POLICY "Users can view own tenant"
ON fec_tenants FOR SELECT
USING (
  id IN (SELECT fec_tenant_id FROM profiles WHERE user_id = auth.uid())
);

-- Admins can view all tenants
CREATE POLICY "Admins can view all tenants"  
ON fec_tenants FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update any tenant
CREATE POLICY "Admins can update all tenants"
ON fec_tenants FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- USER_ROLES TABLE: Verify admin-only access
-- ============================================================================

DROP POLICY IF EXISTS "Only admins can view user roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;

-- Only admins can view user roles
CREATE POLICY "Admins can view user roles"
ON user_roles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert user roles
CREATE POLICY "Admins can insert user roles"
ON user_roles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update user roles
CREATE POLICY "Admins can update user roles"
ON user_roles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete user roles
CREATE POLICY "Admins can delete user roles"
ON user_roles FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- TENANT_MANUAL_ACCESS TABLE: Verify admin-only management
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their tenant manual access" ON tenant_manual_access;
DROP POLICY IF EXISTS "Users can view own tenant manual access" ON tenant_manual_access;
DROP POLICY IF EXISTS "Admins can view all tenant manual access" ON tenant_manual_access;
DROP POLICY IF EXISTS "Admins can manage tenant manual access" ON tenant_manual_access;
DROP POLICY IF EXISTS "Admins can insert tenant manual access" ON tenant_manual_access;
DROP POLICY IF EXISTS "Admins can update tenant manual access" ON tenant_manual_access;
DROP POLICY IF EXISTS "Admins can delete tenant manual access" ON tenant_manual_access;

-- Users can view their tenant's manual access
CREATE POLICY "Users can view own tenant manual access"
ON tenant_manual_access FOR SELECT
USING (
  fec_tenant_id IN (SELECT fec_tenant_id FROM profiles WHERE user_id = auth.uid())
);

-- Admins can view all tenant manual access
CREATE POLICY "Admins can view all tenant manual access"
ON tenant_manual_access FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert tenant manual access
CREATE POLICY "Admins can insert tenant manual access"
ON tenant_manual_access FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update tenant manual access
CREATE POLICY "Admins can update tenant manual access"
ON tenant_manual_access FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete tenant manual access
CREATE POLICY "Admins can delete tenant manual access"
ON tenant_manual_access FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));