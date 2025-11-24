-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view documents for their FEC only" ON documents;

-- Create new policy that only checks tenant_manual_access (documents are shared resources)
CREATE POLICY "Users can view documents for accessible manuals"
ON documents FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR manual_id IN (
    SELECT tma.manual_id 
    FROM tenant_manual_access tma
    WHERE tma.fec_tenant_id = get_current_user_fec_tenant_id()
  )
);