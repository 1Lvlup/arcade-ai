-- Allow admins to UPDATE game submissions across all tenants
DROP POLICY IF EXISTS "Users can update their own submissions" ON game_submissions;

CREATE POLICY "Users can update their own submissions"
ON game_submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all game submissions"
ON game_submissions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to DELETE game submissions across all tenants  
DROP POLICY IF EXISTS "Users can delete their own submissions" ON game_submissions;

CREATE POLICY "Users can delete their own submissions"
ON game_submissions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete all game submissions"
ON game_submissions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));