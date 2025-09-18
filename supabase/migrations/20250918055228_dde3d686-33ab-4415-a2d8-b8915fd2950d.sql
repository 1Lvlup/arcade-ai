-- Allow users to insert new FEC tenants during signup
CREATE POLICY "Users can insert new FEC tenants" 
ON public.fec_tenants 
FOR INSERT 
WITH CHECK (true);