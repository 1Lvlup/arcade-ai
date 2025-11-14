-- Create chat-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true);

-- RLS policies for chat-images bucket
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view chat images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-images');

CREATE POLICY "Users can delete their own chat images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add images column to conversation_messages table
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- Add image_analysis column to store GPT-5's vision analysis
ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS image_analysis jsonb;