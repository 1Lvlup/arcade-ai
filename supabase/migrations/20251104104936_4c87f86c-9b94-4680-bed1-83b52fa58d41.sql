-- Create table for game submissions
CREATE TABLE public.game_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_name TEXT NOT NULL,
  manufacturer TEXT,
  version_model_year TEXT,
  fec_location_name TEXT,
  input_by TEXT,
  user_id UUID NOT NULL,
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "Users can view their own game submissions"
ON public.game_submissions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create submissions for their FEC
CREATE POLICY "Users can create game submissions"
ON public.game_submissions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  fec_tenant_id = get_current_user_fec_tenant_id()
);

-- Users can update their own submissions
CREATE POLICY "Users can update their own submissions"
ON public.game_submissions
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own submissions
CREATE POLICY "Users can delete their own submissions"
ON public.game_submissions
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all submissions for their tenant
CREATE POLICY "Admins can view all submissions for their tenant"
ON public.game_submissions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  fec_tenant_id = get_current_user_fec_tenant_id()
);

-- Create trigger for updating updated_at
CREATE TRIGGER update_game_submissions_updated_at
BEFORE UPDATE ON public.game_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();