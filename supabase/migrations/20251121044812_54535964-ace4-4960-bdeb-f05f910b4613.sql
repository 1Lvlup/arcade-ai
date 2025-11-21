-- Add content_format column to blog_posts to support multiple content formats
ALTER TABLE blog_posts 
ADD COLUMN content_format TEXT DEFAULT 'html' CHECK (content_format IN ('html', 'markdown', 'plaintext'));