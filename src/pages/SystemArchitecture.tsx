import { useState } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, FileCode, Database, Search, Copy, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface FileReference {
  path: string;
  purpose: string;
  lines?: string;
  status: 'working' | 'needs-attention' | 'in-development';
}

interface FeatureCategory {
  id: string;
  icon: string;
  title: string;
  description: string;
  files: FileReference[];
  database?: string[];
  storage?: string[];
  edgeFunctions?: string[];
}

const SystemArchitecture = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const { toast } = useToast();

  const categories: FeatureCategory[] = [
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
        { path: 'supabase/functions/reingest-manual/index.ts', purpose: 'Re-process existing manual with new settings', status: 'working' },
        { path: 'supabase/functions/delete-manual/index.ts', purpose: 'Manual deletion (cascades to chunks & figures)', status: 'working' },
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
  ];

  const filteredCategories = searchQuery
    ? categories.filter(
        (cat) =>
          cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.files.some((f) => f.path.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : categories;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    toast({
      title: 'Copied to clipboard',
      description: text,
    });
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const getStatusBadge = (status: FileReference['status']) => {
    const variants = {
      'working': { variant: 'default' as const, text: '✅ Working' },
      'needs-attention': { variant: 'destructive' as const, text: '⚠️ Needs Attention' },
      'in-development': { variant: 'secondary' as const, text: '🔧 In Dev' },
    };
    const { variant, text } = variants[status];
    return <Badge variant={variant} className="text-xs">{text}</Badge>;
  };

  return (
    <>
      <SharedHeader />
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AdminSidebar activeTab="system" onTabChange={() => {}} />
          
          <SidebarInset className="flex-1">
            <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
              <SidebarTrigger className="-ml-1" />
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <FileCode className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">System Architecture</h1>
                  <p className="text-xs text-muted-foreground">File mappings & feature documentation</p>
                </div>
              </div>
            </header>

            <main className="flex-1 p-8 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Architecture Documentation</CardTitle>
                  <CardDescription>
                    Comprehensive mapping of files, edge functions, and database tables for each feature area.
                    This helps identify which files are responsible for specific functionality.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search features, files, or functionality..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Accordion type="single" collapsible className="w-full space-y-4">
                    {filteredCategories.map((category) => (
                      <AccordionItem
                        key={category.id}
                        value={category.id}
                        className="border rounded-lg bg-card"
                      >
                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                          <div className="flex items-center gap-4 text-left">
                            <span className="text-3xl">{category.icon}</span>
                            <div>
                              <h3 className="text-lg font-semibold">{category.title}</h3>
                              <p className="text-sm text-muted-foreground">{category.description}</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 space-y-6">
                          {/* Files */}
                          <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <FileCode className="h-4 w-4" />
                              Files
                            </h4>
                            <div className="space-y-2">
                              {category.files.map((file) => (
                                <div
                                  key={file.path}
                                  className="flex items-start gap-3 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                                >
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <code className="text-xs font-mono bg-background px-2 py-1 rounded">
                                        {file.path}
                                      </code>
                                      {file.lines && (
                                        <Badge variant="outline" className="text-xs">
                                          Lines {file.lines}
                                        </Badge>
                                      )}
                                      {getStatusBadge(file.status)}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{file.purpose}</p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => copyToClipboard(file.path)}
                                  >
                                    {copiedPath === file.path ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Database Tables */}
                          {category.database && (
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Database Tables & Columns
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {category.database.map((table) => (
                                  <Badge key={table} variant="secondary" className="font-mono text-xs">
                                    {table}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Storage Buckets */}
                          {category.storage && (
                            <div>
                              <h4 className="font-semibold mb-3">Storage Buckets</h4>
                              <div className="flex flex-wrap gap-2">
                                {category.storage.map((bucket) => (
                                  <Badge key={bucket} variant="outline" className="font-mono text-xs">
                                    📦 {bucket}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Edge Functions */}
                          {category.edgeFunctions && (
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                ⚡ Edge Functions
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  asChild
                                >
                                  <a
                                    href="https://supabase.com/dashboard/project/wryxbfnmecjffxolcgfa/functions"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    View in Supabase
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {category.edgeFunctions.map((fn) => (
                                  <Badge key={fn} variant="secondary" className="font-mono text-xs">
                                    {fn}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  {filteredCategories.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No features match your search query.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </>
  );
};

export default SystemArchitecture;
