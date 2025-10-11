-- Enable RLS on manual_metadata if not already enabled
ALTER TABLE public.manual_metadata ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read manual_metadata" ON public.manual_metadata;
DROP POLICY IF EXISTS "Allow authenticated users to insert manual_metadata" ON public.manual_metadata;
DROP POLICY IF EXISTS "Allow authenticated users to update manual_metadata" ON public.manual_metadata;

-- Create read policy for authenticated users
CREATE POLICY "Allow authenticated users to read manual_metadata"
ON public.manual_metadata
FOR SELECT
TO authenticated
USING (true);

-- Create insert policy for authenticated users
CREATE POLICY "Allow authenticated users to insert manual_metadata"
ON public.manual_metadata
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create update policy for authenticated users
CREATE POLICY "Allow authenticated users to update manual_metadata"
ON public.manual_metadata
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);