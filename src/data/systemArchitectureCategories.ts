export interface FileReference {
  path: string;
  purpose: string;
  lines?: string;
  status: 'working' | 'needs-attention' | 'in-development';
}

export interface FeatureCategory {
  id: string;
  icon: string;
  title: string;
  description: string;
  files: FileReference[];
  database?: string[];
  storage?: string[];
  edgeFunctions?: string[];
}

export const systemArchitectureCategories: FeatureCategory[] = [
  {
    id: 'sms',
    icon: '📱',
    title: 'SMS System',
    description: 'Twilio SMS webhook, game selection flow, and user opt-in management',
    files: [
      { path: 'supabase/functions/sms-tech-assistant/index.ts', purpose: 'Main SMS webhook - handles incoming texts, game selection flow, AI responses', status: 'working' },
      { path: 'supabase/functions/send-test-sms/index.ts', purpose: 'Manual SMS testing utility', status: 'working' },
      { path: 'src/components/SMSSettingsManager.tsx', purpose: 'SMS opt-in/configuration UI', status: 'working' },
      { path: 'src/components/SMSTestSender.tsx', purpose: 'Test SMS interface', status: 'working' },
      { path: 'src/components/SMSAnalyticsDashboard.tsx', purpose: 'SMS usage analytics', status: 'working' },
    ],
    database: ['profiles.sms_opt_in', 'profiles.phone_number', 'profiles.sms_selected_manual_id', 'profiles.sms_selected_manual_title'],
    edgeFunctions: ['sms-tech-assistant', 'send-test-sms'],
  },
  {
    id: 'ai-rag',
    icon: '🤖',
    title: 'AI Answer System (RAG Pipeline)',
    description: 'Retrieval-Augmented Generation pipeline, hybrid search, and answer generation',
    files: [
      { path: 'supabase/functions/chat-manual/index.ts', purpose: 'Main chat endpoint - RAG pipeline V3, answer generation (1520 lines)', lines: '1-1520', status: 'working' },
      { path: 'supabase/functions/_shared/answerStyle.ts', purpose: 'Answer Style V2 - adaptive prompts based on retrieval quality', status: 'working' },
      { path: 'supabase/functions/_shared/rag.ts', purpose: 'RAG utilities, citations builder, image thumbnail selection', status: 'working' },
      { path: 'supabase/functions/search-unified/index.ts', purpose: 'Unified hybrid search (vector + text + reranking)', status: 'working' },
      { path: 'supabase/functions/search-manuals-robust/index.ts', purpose: 'Legacy MMR-based search (for A/B testing)', status: 'working' },
      { path: 'src/components/ChatBot.tsx', purpose: 'Main chat UI component (2183 lines)', lines: '1-2183', status: 'working' },
      { path: 'src/components/chat/StructuredAnswerRenderer.tsx', purpose: 'Renders AI responses with interactive elements', status: 'working' },
      { path: 'src/components/RAGDebugPanel.tsx', purpose: 'Debug panel for retrieval quality signals', status: 'working' },
    ],
    database: ['chunks_text', 'figures', 'documents', 'query_logs', 'ai_config', 'manual_metadata', 'answer_evaluations'],
    edgeFunctions: ['chat-manual', 'search-unified', 'search-manuals-robust', 'evaluate-answer'],
  },
  {
    id: 'vision',
    icon: '🖼️',
    title: 'Image/Vision Analysis',
    description: 'User-uploaded image processing, figure captioning, OCR, and vision AI integration',
    files: [
      { path: 'supabase/functions/chat-manual/index.ts', purpose: 'Vision API integration in chat (lines 441-520)', lines: '441-520', status: 'working' },
      { path: 'supabase/functions/generate-image-caption/index.ts', purpose: 'Figure captioning with GPT-4 Vision', status: 'working' },
      { path: 'supabase/functions/batch-image-ocr/index.ts', purpose: 'Batch OCR processing for manual figures', status: 'working' },
      { path: 'supabase/functions/process-figure-ocr/index.ts', purpose: 'Single figure OCR processing', status: 'working' },
      { path: 'src/components/ChatBot.tsx', purpose: 'Image upload handling (uploadImagesToStorage)', status: 'working' },
    ],
    storage: ['chat-images (user uploads)', 'manual-figures (extracted diagrams)'],
    database: ['figures.ocr_text', 'figures.caption_text', 'figures.vision_metadata', 'figures.embedding'],
    edgeFunctions: ['chat-manual', 'generate-image-caption', 'batch-image-ocr', 'process-figure-ocr'],
  },
  {
    id: 'manual-processing',
    icon: '📄',
    title: 'Manual Processing Pipeline',
    description: 'PDF upload, LlamaCloud parsing, chunking, figure extraction, and reprocessing',
    files: [
      { path: 'supabase/functions/upload-manual/index.ts', purpose: 'PDF upload & LlamaCloud parsing initiation', status: 'working' },
      { path: 'supabase/functions/llama-webhook/index.ts', purpose: 'Webhook receiver from LlamaCloud - processes chunks & figures', status: 'working' },
      { path: 'supabase/functions/process-figure-captions/index.ts', purpose: 'Figure enhancement & caption generation', status: 'working' },
      { path: 'supabase/functions/sync-processing-status/index.ts', purpose: 'Syncs/corrects processing status from actual data', status: 'working' },
      { path: 'supabase/functions/reingest-manual/index.ts', purpose: 'Re-process existing manual with new settings', status: 'working' },
      { path: 'supabase/functions/delete-manual/index.ts', purpose: 'Manual deletion (cascades to chunks & figures)', status: 'working' },
      { path: 'src/components/ProcessingMonitor.tsx', purpose: 'Main status display UI - shows phases, progress bars, metrics', status: 'needs-attention' },
      { path: 'src/components/LiveProcessingMonitor.tsx', purpose: 'Real-time popup in bottom-right corner during processing', status: 'working' },
      { path: 'src/components/ManualUpload.tsx', purpose: 'Upload UI component', status: 'working' },
      { path: 'src/pages/ManualManagement.tsx', purpose: 'Manual admin dashboard', status: 'working' },
    ],
    database: ['documents', 'chunks_text', 'figures', 'manual_pages', 'manual_metadata', 'processing_status'],
    edgeFunctions: ['upload-manual', 'llama-webhook', 'reingest-manual', 'delete-manual', 'process-figure-captions'],
  },
  {
    id: 'training',
    icon: '🎓',
    title: 'Training/QA System',
    description: 'Training data management, automated QA generation, answer evaluation',
    files: [
      { path: 'supabase/functions/training-inbox/index.ts', purpose: 'Training data management - fetch queries for review', status: 'working' },
      { path: 'supabase/functions/training-generate-qa/index.ts', purpose: 'Auto-generate Q&A pairs from manuals', status: 'working' },
      { path: 'supabase/functions/training-export/index.ts', purpose: 'Export training data for fine-tuning', status: 'working' },
      { path: 'supabase/functions/evaluate-answer/index.ts', purpose: 'Automated answer quality evaluation', status: 'needs-attention' },
      { path: 'src/pages/TrainingHub.tsx', purpose: 'Training overview dashboard', status: 'working' },
      { path: 'src/pages/TrainingInbox.tsx', purpose: 'Review queries for training data', status: 'working' },
      { path: 'src/pages/TrainingExamples.tsx', purpose: 'Browse/edit training examples', status: 'working' },
      { path: 'src/pages/TrainingQAGeneration.tsx', purpose: 'Generate QA pairs UI', status: 'working' },
    ],
    database: ['query_logs', 'answer_evaluations', 'feedback', 'training_examples (if exists)'],
    edgeFunctions: ['training-inbox', 'training-generate-qa', 'training-export', 'evaluate-answer'],
  },
  {
    id: 'auth',
    icon: '🔐',
    title: 'Authentication & Users',
    description: 'User authentication, role management, and subscription checks',
    files: [
      { path: 'src/hooks/useAuth.tsx', purpose: 'Auth hook - login, logout, user state', status: 'working' },
      { path: 'src/hooks/useAdminCheck.tsx', purpose: 'Admin role check hook', status: 'working' },
      { path: 'src/hooks/useSubscription.tsx', purpose: 'Subscription status check', status: 'working' },
      { path: 'src/components/AuthProtectedRoute.tsx', purpose: 'Route protection - requires auth', status: 'working' },
      { path: 'src/components/AdminRoute.tsx', purpose: 'Route protection - requires admin role', status: 'working' },
      { path: 'supabase/functions/manage-user-role/index.ts', purpose: 'Role management (admin promotion)', status: 'working' },
    ],
    database: ['profiles', 'profiles.fec_tenant_id', 'auth.users (Supabase managed)'],
    edgeFunctions: ['manage-user-role'],
  },
  {
    id: 'subscription',
    icon: '💳',
    title: 'Subscription/Billing',
    description: 'Stripe integration, checkout, and subscription management',
    files: [
      { path: 'supabase/functions/create-checkout/index.ts', purpose: 'Stripe checkout session creation', status: 'working' },
      { path: 'supabase/functions/customer-portal/index.ts', purpose: 'Stripe customer portal link generation', status: 'working' },
      { path: 'supabase/functions/check-subscription/index.ts', purpose: 'Subscription status verification', status: 'working' },
      { path: 'src/pages/Pricing.tsx', purpose: 'Pricing page with subscription tiers', status: 'working' },
    ],
    database: ['subscriptions (if exists)', 'profiles.has_ever_subscribed'],
    edgeFunctions: ['create-checkout', 'customer-portal', 'check-subscription'],
  },
  {
    id: 'code-assistant',
    icon: '🧑‍💻',
    title: 'Code Assistant / System Architecture',
    description: 'AI code assistant with file selection, system architecture browser, and GitHub sync',
    files: [
      { path: 'src/pages/CodeAssistant.tsx', purpose: 'Main code assistant page with chat and file selection', status: 'working' },
      { path: 'src/data/systemArchitectureCategories.ts', purpose: 'System architecture category definitions', status: 'working' },
      { path: 'src/hooks/useValidatedArchitectureCategories.ts', purpose: 'Hook to fetch and validate categories against indexed_codebase', status: 'working' },
      { path: 'src/components/code-assistant/SystemArchitectureSelector.tsx', purpose: 'UI for browsing and selecting files by feature category', status: 'working' },
      { path: 'src/components/code-assistant/FileTreeView.tsx', purpose: 'File tree browser with folder structure', status: 'working' },
      { path: 'src/components/code-assistant/FileChunkSelector.tsx', purpose: 'Chunk-level file selection for granular context', status: 'working' },
      { path: 'supabase/functions/ai-code-assistant/index.ts', purpose: 'AI assistant edge function for code questions', status: 'working' },
      { path: 'supabase/functions/sync-github-repo/index.ts', purpose: 'GitHub repository sync to indexed_codebase', status: 'working' },
      { path: 'supabase/functions/index-codebase/index.ts', purpose: 'Codebase indexing and parsing', status: 'working' },
    ],
    database: ['indexed_codebase', 'profiles.github_repository', 'profiles.github_branch', 'profiles.github_auto_sync_enabled'],
    edgeFunctions: ['ai-code-assistant', 'sync-github-repo', 'index-codebase'],
  },
];
