-- Fix AWS region from us-east-1 to us-east-2 for existing figure URLs
UPDATE figures
SET image_url = REPLACE(image_url, '.s3.us-east-1.amazonaws.com/', '.s3.us-east-2.amazonaws.com/')
WHERE image_url LIKE '%.s3.us-east-1.amazonaws.com/%';

-- Also create a new migration to fix the hardcoded region in the previous migration
-- This replaces the previous migration's hardcoded us-east-1 with us-east-2
UPDATE figures
SET image_url = REGEXP_REPLACE(
  image_url,
  '^s3://([^/]+)/',
  'https://\1.s3.us-east-2.amazonaws.com/'
)
WHERE image_url LIKE 's3://%';