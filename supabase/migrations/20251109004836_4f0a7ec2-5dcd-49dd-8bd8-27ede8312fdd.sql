-- Allow admins to view ALL game submissions across all tenants
DROP POLICY IF EXISTS "Admins can view all submissions for their tenant" ON game_submissions;

CREATE POLICY "Admins can view all game submissions"
ON game_submissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));