-- Create forum_votes table
CREATE TABLE public.forum_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT vote_target_check CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT unique_user_post_vote UNIQUE (user_id, post_id),
  CONSTRAINT unique_user_comment_vote UNIQUE (user_id, comment_id)
);

-- Add vote counts to forum_posts
ALTER TABLE public.forum_posts 
ADD COLUMN upvote_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN downvote_count INTEGER DEFAULT 0 NOT NULL;

-- Add vote counts to forum_comments
ALTER TABLE public.forum_comments 
ADD COLUMN upvote_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN downvote_count INTEGER DEFAULT 0 NOT NULL;

-- Create indexes for performance
CREATE INDEX idx_forum_votes_user_id ON public.forum_votes(user_id);
CREATE INDEX idx_forum_votes_post_id ON public.forum_votes(post_id);
CREATE INDEX idx_forum_votes_comment_id ON public.forum_votes(comment_id);

-- Enable RLS
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forum_votes
CREATE POLICY "Anyone can view forum votes"
  ON public.forum_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create votes"
  ON public.forum_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
  ON public.forum_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.forum_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update vote counts on posts
CREATE OR REPLACE FUNCTION public.update_post_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'upvote' THEN
      UPDATE public.forum_posts 
      SET upvote_count = upvote_count + 1 
      WHERE id = NEW.post_id;
    ELSE
      UPDATE public.forum_posts 
      SET downvote_count = downvote_count + 1 
      WHERE id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type = 'upvote' AND NEW.vote_type = 'downvote' THEN
      UPDATE public.forum_posts 
      SET upvote_count = upvote_count - 1, downvote_count = downvote_count + 1 
      WHERE id = NEW.post_id;
    ELSIF OLD.vote_type = 'downvote' AND NEW.vote_type = 'upvote' THEN
      UPDATE public.forum_posts 
      SET upvote_count = upvote_count + 1, downvote_count = downvote_count - 1 
      WHERE id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'upvote' THEN
      UPDATE public.forum_posts 
      SET upvote_count = upvote_count - 1 
      WHERE id = OLD.post_id;
    ELSE
      UPDATE public.forum_posts 
      SET downvote_count = downvote_count - 1 
      WHERE id = OLD.post_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to update vote counts on comments
CREATE OR REPLACE FUNCTION public.update_comment_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'upvote' THEN
      UPDATE public.forum_comments 
      SET upvote_count = upvote_count + 1 
      WHERE id = NEW.comment_id;
    ELSE
      UPDATE public.forum_comments 
      SET downvote_count = downvote_count + 1 
      WHERE id = NEW.comment_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type = 'upvote' AND NEW.vote_type = 'downvote' THEN
      UPDATE public.forum_comments 
      SET upvote_count = upvote_count - 1, downvote_count = downvote_count + 1 
      WHERE id = NEW.comment_id;
    ELSIF OLD.vote_type = 'downvote' AND NEW.vote_type = 'upvote' THEN
      UPDATE public.forum_comments 
      SET upvote_count = upvote_count + 1, downvote_count = downvote_count - 1 
      WHERE id = NEW.comment_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'upvote' THEN
      UPDATE public.forum_comments 
      SET upvote_count = upvote_count - 1 
      WHERE id = OLD.comment_id;
    ELSE
      UPDATE public.forum_comments 
      SET downvote_count = downvote_count - 1 
      WHERE id = OLD.comment_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers for post votes
CREATE TRIGGER update_post_votes_on_insert
  AFTER INSERT ON public.forum_votes
  FOR EACH ROW
  WHEN (NEW.post_id IS NOT NULL)
  EXECUTE FUNCTION public.update_post_vote_counts();

CREATE TRIGGER update_post_votes_on_update
  AFTER UPDATE ON public.forum_votes
  FOR EACH ROW
  WHEN (NEW.post_id IS NOT NULL)
  EXECUTE FUNCTION public.update_post_vote_counts();

CREATE TRIGGER update_post_votes_on_delete
  AFTER DELETE ON public.forum_votes
  FOR EACH ROW
  WHEN (OLD.post_id IS NOT NULL)
  EXECUTE FUNCTION public.update_post_vote_counts();

-- Triggers for comment votes
CREATE TRIGGER update_comment_votes_on_insert
  AFTER INSERT ON public.forum_votes
  FOR EACH ROW
  WHEN (NEW.comment_id IS NOT NULL)
  EXECUTE FUNCTION public.update_comment_vote_counts();

CREATE TRIGGER update_comment_votes_on_update
  AFTER UPDATE ON public.forum_votes
  FOR EACH ROW
  WHEN (NEW.comment_id IS NOT NULL)
  EXECUTE FUNCTION public.update_comment_vote_counts();

CREATE TRIGGER update_comment_votes_on_delete
  AFTER DELETE ON public.forum_votes
  FOR EACH ROW
  WHEN (OLD.comment_id IS NOT NULL)
  EXECUTE FUNCTION public.update_comment_vote_counts();