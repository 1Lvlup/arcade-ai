-- Fix RLS policies to allow true cross-tenant admin access

-- Drop existing admin conversation policies
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can view all conversation messages" ON public.conversation_messages;

-- Create new cross-tenant admin policies for conversations
CREATE POLICY "Admins can view all conversations across all tenants"
ON public.conversations
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all conversation messages across all tenants"
ON public.conversation_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Also ensure admins can view all profiles across tenants
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles across all tenants"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));