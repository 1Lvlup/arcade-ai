-- Simplify blog posts to use text author field instead of user reference
-- Drop the author_id foreign key column
ALTER TABLE blog_posts DROP COLUMN author_id;

-- Add a simple author_name text field
ALTER TABLE blog_posts ADD COLUMN author_name TEXT DEFAULT 'Admin';