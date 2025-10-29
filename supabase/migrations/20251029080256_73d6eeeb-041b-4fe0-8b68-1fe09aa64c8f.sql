-- Add admin policy for viewing all conversations
CREATE POLICY "Admins can view all conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Add admin policy for viewing all conversation messages
CREATE POLICY "Admins can view all conversation messages"
ON public.conversation_messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));