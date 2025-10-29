-- Fix SECURITY DEFINER functions missing search_path protection
-- Add SET search_path = public to prevent privilege escalation

-- 1. normalize_name
CREATE OR REPLACE FUNCTION public.normalize_name(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN TRIM(REGEXP_REPLACE(
    REGEXP_REPLACE(
      LOWER(COALESCE(input_text, '')),
      '[^a-z0-9]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
END;
$$;

-- 2. slugify
CREATE OR REPLACE FUNCTION public.slugify(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN REPLACE(public.normalize_name(input_text), ' ', '-');
END;
$$;

-- 3. get_current_user_fec_tenant_id
CREATE OR REPLACE FUNCTION public.get_current_user_fec_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fec_tenant_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- 4. has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 5. get_manuals_for_dropdown
CREATE OR REPLACE FUNCTION public.get_manuals_for_dropdown()
RETURNS TABLE(manual_id text, canonical_title text, canonical_slug text, platform text, doc_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mm.manual_id, mm.canonical_title, mm.canonical_slug, mm.platform, mm.doc_type
  FROM public.manual_metadata mm
  ORDER BY mm.canonical_title;
$$;