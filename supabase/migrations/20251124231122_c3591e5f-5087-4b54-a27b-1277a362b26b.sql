-- Drop restrictive policies that check tenant_manual_access
DROP POLICY IF EXISTS "Users can view documents for accessible manuals" ON documents;
DROP POLICY IF EXISTS "Users can view documents for their FEC only" ON documents;

-- Create open policy for documents - all authenticated users can see all manuals
CREATE POLICY "All authenticated users can view all documents"
ON documents FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Drop restrictive policies on chunks_text
DROP POLICY IF EXISTS "Users can view chunks for their FEC only" ON chunks_text;

-- Create open policy for chunks_text - all authenticated users can see all chunks
CREATE POLICY "All authenticated users can view all chunks"
ON chunks_text FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Drop restrictive policies on figures
DROP POLICY IF EXISTS "Users can view figures for their FEC only" ON figures;

-- Create open policy for figures - all authenticated users can see all figures
CREATE POLICY "All authenticated users can view all figures"
ON figures FOR SELECT
USING (auth.uid() IS NOT NULL);