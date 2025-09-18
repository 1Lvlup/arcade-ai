-- Make sure RLS is ON for Storage objects (it is by default)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Clean up any old policies with the same names
DROP POLICY IF EXISTS "svc all access to manuals" ON storage.objects;
DROP POLICY IF EXISTS "auth upload to manuals under uid prefix" ON storage.objects;
DROP POLICY IF EXISTS "auth read own manuals objects" ON storage.objects;

-- 1) Edge Functions (service_role) can do ALL operations within manuals/*
CREATE POLICY "svc all access to manuals"
ON storage.objects
AS PERMISSIVE
FOR ALL
TO service_role
USING (bucket_id = 'manuals')
WITH CHECK (bucket_id = 'manuals');

-- 2) Authenticated users can UPLOAD only under a path that starts with their uid
CREATE POLICY "auth upload to manuals under uid prefix"
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'manuals'
  AND (position((auth.uid())::text || '/' in name) = 1)  -- name LIKE '<uid>/%'
);

-- 3) Authenticated users can READ only their own files in manuals/*
CREATE POLICY "auth read own manuals objects"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  bucket_id = 'manuals'
  AND owner = auth.uid()
);