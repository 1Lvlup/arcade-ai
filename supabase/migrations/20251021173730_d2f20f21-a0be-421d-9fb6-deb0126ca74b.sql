
-- Allow authenticated users to upload to postparse bucket
CREATE POLICY "Users can upload to postparse bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'postparse'
);

-- Allow authenticated users to read from postparse bucket
CREATE POLICY "Users can read from postparse bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'postparse');

-- Allow authenticated users to update files in postparse bucket
CREATE POLICY "Users can update postparse bucket files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'postparse')
WITH CHECK (bucket_id = 'postparse');

-- Allow service role to manage postparse bucket
CREATE POLICY "Service can manage postparse bucket"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'postparse')
WITH CHECK (bucket_id = 'postparse');
