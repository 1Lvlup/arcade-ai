-- Create conversations table for persistent memory
CREATE TABLE IF NOT EXISTS public.code_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.code_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.code_assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create codebase files table to store uploaded/pasted files
CREATE TABLE IF NOT EXISTS public.code_assistant_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.code_assistant_conversations(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_content TEXT NOT NULL,
  language TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.code_assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_assistant_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations"
  ON public.code_assistant_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON public.code_assistant_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.code_assistant_conversations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.code_assistant_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages from their conversations"
  ON public.code_assistant_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.code_assistant_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON public.code_assistant_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.code_assistant_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for files
CREATE POLICY "Users can view files from their conversations"
  ON public.code_assistant_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.code_assistant_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create files in their conversations"
  ON public.code_assistant_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.code_assistant_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete files from their conversations"
  ON public.code_assistant_files
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.code_assistant_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_conversations_user_id ON public.code_assistant_conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON public.code_assistant_messages(conversation_id);
CREATE INDEX idx_files_conversation_id ON public.code_assistant_files(conversation_id);