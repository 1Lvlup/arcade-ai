-- Add INSERT policy for postparse bucket to allow service role uploads
CREATE POLICY "Service role can upload to postparse"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'postparse');