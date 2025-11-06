-- Create table for game requests
CREATE TABLE public.game_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_name TEXT NOT NULL,
  request_date DATE NOT NULL,
  game_names TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.game_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert game requests
CREATE POLICY "Anyone can create game requests"
  ON public.game_requests
  FOR INSERT
  WITH CHECK (true);

-- Users can view their own requests
CREATE POLICY "Users can view their own requests"
  ON public.game_requests
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_game_requests_updated_at
  BEFORE UPDATE ON public.game_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_game_requests_user_id ON public.game_requests(user_id);
CREATE INDEX idx_game_requests_status ON public.game_requests(status);