-- Fix existing s3:// URLs to use https:// format
UPDATE figures
SET image_url = REGEXP_REPLACE(
  image_url,
  '^s3://([^/]+)/',
  'https://\1.s3.us-east-1.amazonaws.com/'
)
WHERE image_url LIKE 's3://%';