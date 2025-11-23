-- Enable RLS on down_games table (if not already enabled)
ALTER TABLE down_games ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all down games
CREATE POLICY "Anyone can view down games"
ON down_games
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert down games
CREATE POLICY "Authenticated users can insert down games"
ON down_games
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update down games
CREATE POLICY "Authenticated users can update down games"
ON down_games
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete down games
CREATE POLICY "Authenticated users can delete down games"
ON down_games
FOR DELETE
TO authenticated
USING (true);