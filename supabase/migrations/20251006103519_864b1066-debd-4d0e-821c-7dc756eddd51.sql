-- Allow public read access to images in the postparse bucket
CREATE POLICY "Public read access for postparse images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'postparse');