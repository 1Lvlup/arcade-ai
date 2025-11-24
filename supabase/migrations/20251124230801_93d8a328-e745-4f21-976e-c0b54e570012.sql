-- Drop the old policy that's blocking regular users
DROP POLICY IF EXISTS "Users can view their tenant manual access" ON tenant_manual_access;

-- Create new policy using direct auth.uid() lookup instead of helper function
CREATE POLICY "Users can view their tenant manual access"
ON tenant_manual_access FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR fec_tenant_id IN (
    SELECT fec_tenant_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);