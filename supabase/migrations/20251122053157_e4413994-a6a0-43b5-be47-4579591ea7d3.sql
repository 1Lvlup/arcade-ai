-- Add GitHub repository configuration to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS github_repository TEXT,
ADD COLUMN IF NOT EXISTS github_branch TEXT DEFAULT 'main',
ADD COLUMN IF NOT EXISTS github_auto_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS github_last_sync TIMESTAMP WITH TIME ZONE;

-- Add selected files JSON to conversations
ALTER TABLE public.code_assistant_conversations
ADD COLUMN IF NOT EXISTS selected_file_ids JSONB DEFAULT '[]'::jsonb;

-- Comment on columns
COMMENT ON COLUMN public.profiles.github_repository IS 'GitHub repository in format owner/repo';
COMMENT ON COLUMN public.profiles.github_branch IS 'GitHub branch to sync from';
COMMENT ON COLUMN public.profiles.github_auto_sync_enabled IS 'Whether auto-sync is enabled for this user';
COMMENT ON COLUMN public.profiles.github_last_sync IS 'Last time GitHub was synced';
COMMENT ON COLUMN public.code_assistant_conversations.selected_file_ids IS 'Array of indexed_codebase file IDs selected for this conversation';