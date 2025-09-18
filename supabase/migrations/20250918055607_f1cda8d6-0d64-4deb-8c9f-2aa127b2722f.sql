-- Allow anyone to create FEC tenants (needed for signup flow)
DROP POLICY IF EXISTS "Users can insert new FEC tenants" ON public.fec_tenants;

CREATE POLICY "Allow FEC creation for signup" 
ON public.fec_tenants 
FOR INSERT 
WITH CHECK (true);