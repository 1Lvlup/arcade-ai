-- Add UPDATE policy for figures table to allow authenticated users to edit captions
CREATE POLICY "Users can update figures they have access to"
ON public.figures
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is admin
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Allow if user has access to the manual this figure belongs to
  (
    fec_tenant_id = get_current_user_fec_tenant_id()
    AND 
    (
      manual_id IN (
        SELECT tma.manual_id
        FROM tenant_manual_access tma
        WHERE tma.fec_tenant_id = get_current_user_fec_tenant_id()
      )
    )
  )
)
WITH CHECK (
  -- Same check for the updated row
  has_role(auth.uid(), 'admin'::app_role)
  OR
  (
    fec_tenant_id = get_current_user_fec_tenant_id()
    AND 
    (
      manual_id IN (
        SELECT tma.manual_id
        FROM tenant_manual_access tma
        WHERE tma.fec_tenant_id = get_current_user_fec_tenant_id()
      )
    )
  )
);