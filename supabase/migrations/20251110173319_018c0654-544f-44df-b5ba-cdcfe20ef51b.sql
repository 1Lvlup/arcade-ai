-- Add policy for admins to view all game requests
CREATE POLICY "Admins can view all game requests"
ON public.game_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to update game requests
CREATE POLICY "Admins can update game requests"
ON public.game_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to delete game requests
CREATE POLICY "Admins can delete game requests"
ON public.game_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));