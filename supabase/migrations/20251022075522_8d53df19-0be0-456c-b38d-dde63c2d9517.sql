-- ============================================================
-- PHASE 2: RLS SECURITY HARDENING (REVISED)
-- ============================================================
-- This migration:
-- 1. Enables RLS on page_label_map (CRITICAL - currently public!)
-- 2. Adds DELETE policies to tables that don't have them
-- 3. Fixes manual_metadata policy conflicts
-- ============================================================

-- ============================================================
-- 2.1 CRITICAL FIX: Enable RLS on page_label_map
-- ============================================================

ALTER TABLE page_label_map ENABLE ROW LEVEL SECURITY;

-- Service can manage page label maps during processing
CREATE POLICY "Service can manage page label maps"
ON page_label_map FOR ALL
TO authenticated
USING (
  manual_id IN (
    SELECT d.manual_id FROM documents d
    WHERE d.fec_tenant_id = get_current_tenant_context()
  )
)
WITH CHECK (
  manual_id IN (
    SELECT d.manual_id FROM documents d
    WHERE d.fec_tenant_id = get_current_tenant_context()
  )
);

-- Admins can view page label maps for their tenant
CREATE POLICY "Admins can view page label maps"
ON page_label_map FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND manual_id IN (
    SELECT d.manual_id FROM documents d
    WHERE d.fec_tenant_id = get_current_user_fec_tenant_id()
  )
);

-- Admins can delete page label maps for their tenant
CREATE POLICY "Admins can delete page label maps"
ON page_label_map FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND manual_id IN (
    SELECT d.manual_id FROM documents d
    WHERE d.fec_tenant_id = get_current_user_fec_tenant_id()
  )
);

-- ============================================================
-- 2.2 ADD DELETE POLICIES FOR DATA CLEANUP
-- ============================================================

-- ai_config
CREATE POLICY "Admins can delete AI config for their FEC"
ON ai_config FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete ai_config"
ON ai_config FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- chunk_repage_log
CREATE POLICY "Admins can delete chunk repage logs"
ON chunk_repage_log FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can delete chunk repage logs"
ON chunk_repage_log FOR DELETE
TO authenticated
USING (true);

-- chunks_text
CREATE POLICY "Admins can delete chunks for their FEC"
ON chunks_text FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete chunks"
ON chunks_text FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- code_assistant_messages
CREATE POLICY "Users can delete messages from their conversations"
ON code_assistant_messages FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM code_assistant_conversations
    WHERE code_assistant_conversations.id = code_assistant_messages.conversation_id
      AND code_assistant_conversations.user_id = auth.uid()
  )
);

-- conversation_messages
CREATE POLICY "Users can delete their own conversation messages"
ON conversation_messages FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
  )
);

-- docs
CREATE POLICY "Admins can delete docs for their FEC"
ON docs FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete docs"
ON docs FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- documents
CREATE POLICY "Admins can delete documents for their FEC"
ON documents FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete documents"
ON documents FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- feedback
CREATE POLICY "Admins can delete feedback for their tenant"
ON feedback FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete feedback"
ON feedback FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- golden_questions
CREATE POLICY "Admins can delete golden questions for their FEC"
ON golden_questions FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete golden_questions"
ON golden_questions FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- manual_pages
CREATE POLICY "Admins can delete manual pages"
ON manual_pages FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND manual_id IN (
    SELECT d.manual_id FROM documents d
    WHERE d.fec_tenant_id = get_current_user_fec_tenant_id()
  )
);

CREATE POLICY "Service can delete manual_pages"
ON manual_pages FOR DELETE
TO authenticated
USING (
  manual_id IN (
    SELECT d.manual_id FROM documents d
    WHERE d.fec_tenant_id = get_current_tenant_context()
  )
);

-- model_feedback
CREATE POLICY "Admins can delete model feedback for their tenant"
ON model_feedback FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete model_feedback"
ON model_feedback FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- processing_status
CREATE POLICY "Admins can delete processing status for their FEC"
ON processing_status FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete processing_status"
ON processing_status FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- query_logs
CREATE POLICY "Admins can delete query logs for their tenant"
ON query_logs FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete query_logs"
ON query_logs FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- question_evaluations
CREATE POLICY "Admins can delete question evaluations for their FEC"
ON question_evaluations FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete evaluations"
ON question_evaluations FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- rag_chunks
CREATE POLICY "Admins can delete rag chunks for their FEC"
ON rag_chunks FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete rag_chunks"
ON rag_chunks FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- training_examples
CREATE POLICY "Admins can delete training examples for their tenant"
ON training_examples FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND fec_tenant_id = get_current_user_fec_tenant_id()
);

CREATE POLICY "Service can delete training_examples"
ON training_examples FOR DELETE
TO authenticated
USING (fec_tenant_id = get_current_tenant_context());

-- ============================================================
-- 2.3 FIX manual_metadata POLICY CONFLICTS
-- ============================================================
-- Drop overly permissive policies that allow ANY authenticated user
-- to manage metadata (WITH CHECK true / USING true)

DROP POLICY IF EXISTS "Allow authenticated users to insert manual_metadata" ON manual_metadata;
DROP POLICY IF EXISTS "Allow authenticated users to read manual_metadata" ON manual_metadata;
DROP POLICY IF EXISTS "Allow authenticated users to update manual_metadata" ON manual_metadata;

-- ============================================================
-- END OF MIGRATION
-- ============================================================