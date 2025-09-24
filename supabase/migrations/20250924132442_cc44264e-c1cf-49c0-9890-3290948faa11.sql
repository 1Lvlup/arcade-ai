-- Add unique constraint on (manual_id, figure_id) to prevent duplicates
ALTER TABLE public.figures 
ADD CONSTRAINT figures_manual_figure_unique 
UNIQUE (manual_id, figure_id);

-- Convert existing s3:// URLs to proper HTTPS URLs for accessibility
UPDATE public.figures
SET image_url = REGEXP_REPLACE(
  image_url,
  '^s3://([^/]+)/(.+)$',
  'https://\1.s3.us-east-2.amazonaws.com/\2'
)
WHERE image_url LIKE 's3://%';