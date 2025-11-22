import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SharedHeader } from '@/components/SharedHeader';
import { Send, Code, Copy, Bot, User, FileCode, Plus, Trash2, MessageSquare, X, Search, Loader2, CheckSquare, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { CodeSuggestion } from '@/components/CodeSuggestion';
import { FileTreeView } from '@/components/code-assistant/FileTreeView';
import { SyncStatusBar } from '@/components/code-assistant/SyncStatusBar';
import { CodeAssistantSettings } from '@/components/code-assistant/CodeAssistantSettings';
import { FilePreviewPanel } from '@/components/code-assistant/FilePreviewPanel';
import { ContextSizeIndicator } from '@/components/code-assistant/ContextSizeIndicator';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ParsedCodeBlock {
  filePath: string;
  code: string;
  language: string;
  action: 'CREATE' | 'EDIT';
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  selected_file_ids?: any;
}

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
  last_modified: string;
}

export function CodeAssistant() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  
  // GitHub & File Management
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('main');
  const [autoSyncInterval, setAutoSyncInterval] = useState(300000); // 5 mins default
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [previewFile, setPreviewFile] = useState<IndexedFile | null>(null);
  const [recentlyUsedFiles, setRecentlyUsedFiles] = useState<string[]>([]);
  
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadUserSettings();
    loadConversations();
    loadIndexedFiles();
    loadRecentlyUsedFiles();
  }, []);

  useEffect(() => {
    if (currentConversation) {
      loadConversationData();
    }
  }, [currentConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-sync effect
  useEffect(() => {
    if (autoSyncInterval > 0 && repository) {
      syncGitHub();
      syncIntervalRef.current = setInterval(() => {
        syncGitHub();
      }, autoSyncInterval);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [autoSyncInterval, repository]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('github_repository, github_branch')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setRepository(data.github_repository || '');
      setBranch(data.github_branch || 'main');
    }
  };

  const loadConversations = async () => {
    const { data } = await supabase
      .from('code_assistant_conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (data) setConversations(data);
  };

  const loadIndexedFiles = async () => {
    const { data, error } = await supabase
      .from('indexed_codebase')
      .select('*')
      .order('file_path');
    
    if (!error && data) {
      setIndexedFiles(data);
    }
  };

  const loadConversationData = async () => {
    if (!currentConversation) return;

    const { data: messagesData } = await supabase
      .from('code_assistant_messages')
      .select('*')
      .eq('conversation_id', currentConversation)
      .order('created_at');

    if (messagesData) {
      setMessages(messagesData.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.created_at
      })));
    }

    // Load selected files for this conversation
    const { data: convData } = await supabase
      .from('code_assistant_conversations')
      .select('selected_file_ids')
      .eq('id', currentConversation)
      .single();

    if (convData?.selected_file_ids && Array.isArray(convData.selected_file_ids)) {
      setSelectedFileIds(new Set(convData.selected_file_ids as string[]));
    } else {
      setSelectedFileIds(new Set());
    }
  };

  const syncGitHub = async () => {
    if (!repository) return;
    
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-github-repo', {
        body: { repository },
      });
      
      if (error) throw error;
      
      if (!data?.files || data.files.length === 0) {
        throw new Error('No files found in repository');
      }

      // Clear existing indexed files and insert new ones
      await supabase.from('indexed_codebase').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const filesToInsert = data.files.map((file: any) => ({
        file_path: file.path,
        file_content: file.content,
        language: file.language,
        last_modified: file.last_modified,
      }));

      const { error: insertError } = await supabase
        .from('indexed_codebase')
        .insert(filesToInsert);

      if (insertError) throw insertError;

      await loadIndexedFiles();
      setLastSync(new Date());
      
      toast({
        title: 'GitHub Synced',
        description: `Indexed ${data.files.length} files from ${repository}`,
      });
    } catch (error: any) {
      console.error('GitHub sync error:', error);
      setSyncError(error.message);
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync with GitHub',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const saveSettings = async (settings: { repository: string; branch: string; autoSyncInterval: number }) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({
        github_repository: settings.repository,
        github_branch: settings.branch,
      })
      .eq('user_id', user.id);
    
    if (!error) {
      setRepository(settings.repository);
      setBranch(settings.branch);
      setAutoSyncInterval(settings.autoSyncInterval);
      
      toast({ title: 'Settings Saved', description: 'Your settings have been updated' });
      
      if (settings.repository !== repository) {
        syncGitHub();
      }
    } else {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    }
  };

  const createNewConversation = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('code_assistant_conversations')
      .insert({
        user_id: user.id,
        title: `Conversation ${new Date().toLocaleString()}`,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Failed to create conversation', variant: 'destructive' });
      return;
    }

    setCurrentConversation(data.id);
    setMessages([]);
    setSelectedFileIds(new Set());
    loadConversations();
  };

  const deleteConversation = async (id: string) => {
    await supabase
      .from('code_assistant_conversations')
      .delete()
      .eq('id', id);
    
    loadConversations();
    if (currentConversation === id) {
      setCurrentConversation(null);
      setMessages([]);
      setSelectedFileIds(new Set());
    }
  };

  const handleToggleFile = (fileId: string) => {
    const newSelection = new Set(selectedFileIds);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFileIds(newSelection);
    
    // Track recently used files
    if (newSelection.has(fileId)) {
      updateRecentlyUsedFiles(fileId);
    }
    
    // Save selection to conversation
    if (currentConversation) {
      supabase
        .from('code_assistant_conversations')
        .update({ selected_file_ids: Array.from(newSelection) })
        .eq('id', currentConversation)
        .then();
    }
  };

  const handleToggleFolder = (folderPath: string, select: boolean) => {
    const folderFiles = indexedFiles.filter(f => f.file_path.startsWith(folderPath));
    const newSelection = new Set(selectedFileIds);
    
    folderFiles.forEach(file => {
      if (select) {
        newSelection.add(file.id);
        updateRecentlyUsedFiles(file.id);
      } else {
        newSelection.delete(file.id);
      }
    });
    
    setSelectedFileIds(newSelection);
    
    // Save selection to conversation
    if (currentConversation) {
      supabase
        .from('code_assistant_conversations')
        .update({ selected_file_ids: Array.from(newSelection) })
        .eq('id', currentConversation)
        .then();
    }
  };

  const handleSelectAll = () => {
    const allFileIds = new Set(indexedFiles.map(f => f.id));
    setSelectedFileIds(allFileIds);
    
    if (currentConversation) {
      supabase
        .from('code_assistant_conversations')
        .update({ selected_file_ids: Array.from(allFileIds) })
        .eq('id', currentConversation)
        .then();
    }
  };

  const handleDeselectAll = () => {
    setSelectedFileIds(new Set());
    
    if (currentConversation) {
      supabase
        .from('code_assistant_conversations')
        .update({ selected_file_ids: [] })
        .eq('id', currentConversation)
        .then();
    }
  };

  const handleSelectByType = (type: string) => {
    let filteredFiles: IndexedFile[] = [];
    
    switch (type) {
      case 'typescript':
        filteredFiles = indexedFiles.filter(f => 
          f.language === 'typescript' || 
          f.language === 'javascript' ||
          f.file_path.endsWith('.ts') ||
          f.file_path.endsWith('.tsx') ||
          f.file_path.endsWith('.js') ||
          f.file_path.endsWith('.jsx')
        );
        break;
      case 'edge-functions':
        filteredFiles = indexedFiles.filter(f => f.file_path.includes('supabase/functions'));
        break;
      case 'components':
        filteredFiles = indexedFiles.filter(f => 
          f.file_path.includes('/components/') && 
          (f.file_path.endsWith('.tsx') || f.file_path.endsWith('.jsx'))
        );
        break;
      case 'migrations':
        filteredFiles = indexedFiles.filter(f => f.file_path.includes('migrations'));
        break;
    }
    
    const newSelection = new Set(filteredFiles.map(f => f.id));
    setSelectedFileIds(newSelection);
    
    filteredFiles.forEach(file => updateRecentlyUsedFiles(file.id));
    
    if (currentConversation) {
      supabase
        .from('code_assistant_conversations')
        .update({ selected_file_ids: Array.from(newSelection) })
        .eq('id', currentConversation)
        .then();
    }
  };

  const handleSelectRecentFiles = () => {
    const recentFiles = indexedFiles.filter(f => recentlyUsedFiles.includes(f.id));
    const newSelection = new Set(recentFiles.map(f => f.id));
    setSelectedFileIds(newSelection);
    
    if (currentConversation) {
      supabase
        .from('code_assistant_conversations')
        .update({ selected_file_ids: Array.from(newSelection) })
        .eq('id', currentConversation)
        .then();
    }
  };

  const loadRecentlyUsedFiles = () => {
    const stored = localStorage.getItem('codeAssistantRecentFiles');
    if (stored) {
      try {
        setRecentlyUsedFiles(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse recent files:', e);
      }
    }
  };

  const updateRecentlyUsedFiles = (fileId: string) => {
    setRecentlyUsedFiles(prev => {
      const updated = [fileId, ...prev.filter(id => id !== fileId)].slice(0, 10);
      localStorage.setItem('codeAssistantRecentFiles', JSON.stringify(updated));
      return updated;
    });
  };

  const submitFeedback = async (rating: string, feedbackText: string, expectedAnswer?: string) => {
    if (!feedbackMessageId || !user) return;

    const message = messages.find(m => m.timestamp === feedbackMessageId);
    if (!message) return;

    const { error } = await supabase
      .from('model_feedback')
      .insert({
        user_id: user.id,
        model_type: 'code_assistant',
        conversation_id: currentConversation,
        rating,
        feedback_text: feedbackText,
        expected_answer: expectedAnswer,
        actual_answer: message.content,
        context: { selectedFiles: Array.from(selectedFileIds) }
      });

    if (!error) {
      toast({ title: 'Success', description: 'Feedback submitted! This will help improve the model.' });
      setShowFeedbackDialog(false);
      setFeedbackMessageId(null);
    } else {
      toast({ title: 'Error', description: 'Failed to submit feedback', variant: 'destructive' });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentConversation) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      await supabase
        .from('code_assistant_messages')
        .insert({
          conversation_id: currentConversation,
          role: 'user',
          content: input
        });

      const selectedFiles = indexedFiles.filter(f => selectedFileIds.has(f.id));
      const codebaseContext = selectedFiles.length > 0 
        ? `# Project Files:\n\n${selectedFiles.map(f => `## ${f.file_path}\n\n\`\`\`${f.language || 'text'}\n${f.file_content}\n\`\`\``).join('\n\n')}`
        : '';

      const { data, error } = await supabase.functions.invoke('ai-code-assistant', {
        body: {
          messages: messages.map(m => ({ role: m.role, content: m.content })).concat([
            { role: 'user', content: input }
          ]),
          codebaseContext
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);

      await supabase
        .from('code_assistant_messages')
        .insert({
          conversation_id: currentConversation,
          role: 'assistant',
          content: data.message
        });

      await supabase
        .from('code_assistant_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversation);

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to send message',
        variant: 'destructive',
      });
      
      setMessages(prev => prev.filter(m => m.timestamp !== userMessage.timestamp));
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Code copied to clipboard' });
  };

  const parseCodeBlocks = (content: string): ParsedCodeBlock[] => {
    const blocks: ParsedCodeBlock[] = [];
    const pattern = /📄\s*\*\*File:\s*`([^`]+)`\*\*\s*\[(CREATE|EDIT)\]\s*\n```(\w+)\n([\s\S]*?)```/g;
    
    let match;
    while ((match = pattern.exec(content)) !== null) {
      blocks.push({
        filePath: match[1],
        action: match[2] as 'CREATE' | 'EDIT',
        language: match[3],
        code: match[4].trim()
      });
    }
    
    return blocks;
  };

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="AI Code Assistant" showBackButton={true} backTo="/" />
      
      <main className="flex h-[calc(100vh-64px)] w-full">
        {/* Left Sidebar - File Tree */}
        <div className="w-[350px] border-r bg-background flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Project Files</h2>
            <CodeAssistantSettings
              repository={repository}
              branch={branch}
              autoSyncInterval={autoSyncInterval}
              onSave={saveSettings}
            />
          </div>
          
          <SyncStatusBar
            repository={repository}
            branch={branch}
            lastSync={lastSync}
            isSyncing={isSyncing}
            syncError={syncError}
            fileCount={indexedFiles.length}
            onSync={syncGitHub}
          />
          
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden relative">
            <FileTreeView
              files={indexedFiles}
              selectedFileIds={selectedFileIds}
              onToggleFile={handleToggleFile}
              onToggleFolder={handleToggleFolder}
              searchFilter={searchFilter}
              onPreviewFile={setPreviewFile}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onSelectByType={handleSelectByType}
              recentlyUsedFiles={recentlyUsedFiles}
              onSelectRecentFiles={handleSelectRecentFiles}
            />
            
            <FilePreviewPanel
              file={previewFile}
              isSelected={previewFile ? selectedFileIds.has(previewFile.id) : false}
              onClose={() => setPreviewFile(null)}
              onToggleSelection={() => {
                if (previewFile) {
                  handleToggleFile(previewFile.id);
                }
              }}
            />
          </div>
          
          <ContextSizeIndicator
            selectedFiles={indexedFiles.filter(f => selectedFileIds.has(f.id))}
          />
        </div>

        {/* Right Side - Conversations + Chat */}
        <div className="flex-1 flex flex-col">
          {!currentConversation ? (
            <div className="flex items-center justify-center h-full">
              <Card className="max-w-lg mx-auto">
                <CardContent className="pt-6 space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold">Welcome to AI Code Assistant</h3>
                    <p className="text-sm text-muted-foreground">
                      Your AI pair programmer with full project understanding
                    </p>
                  </div>

                  <Button onClick={createNewConversation} className="w-full" size="lg">
                    <Plus className="h-5 w-5 mr-2" />
                    Start New Conversation
                  </Button>

                  {conversations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Recent Conversations</h4>
                      <ScrollArea className="h-[300px]">
                        {conversations.map(conv => (
                          <div 
                            key={conv.id} 
                            className="flex items-center justify-between p-3 border rounded-lg mb-2 hover:bg-muted/50 cursor-pointer" 
                            onClick={() => setCurrentConversation(conv.id)}
                          >
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              <div>
                                <div className="font-medium text-sm">{conv.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(conv.updated_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="border-b p-4 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createNewConversation}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New
                  </Button>
                  <span className="text-sm font-medium">
                    {conversations.find(c => c.id === currentConversation)?.title}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {selectedFileIds.size} {selectedFileIds.size === 1 ? 'file' : 'files'} loaded
                </Badge>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  {messages.map((message, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.role === 'user' ? 'bg-primary' : 'bg-muted'
                      }`}>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4 text-primary-foreground" />
                        ) : (
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown
                            components={{
                              code({ className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                const inline = !className;
                                
                                return !inline && match ? (
                                  <div className="relative group">
                                    <SyntaxHighlighter
                                      language={match[1]}
                                      PreTag="div"
                                      {...props}
                                    >
                                      {codeString}
                                    </SyntaxHighlighter>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => copyToClipboard(codeString)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        
                        {message.role === 'assistant' && parseCodeBlocks(message.content).length > 0 && (
                          <div className="space-y-2">
                            {parseCodeBlocks(message.content).map((block, blockIdx) => (
                              <CodeSuggestion
                                key={blockIdx}
                                filePath={block.filePath}
                                code={block.code}
                                language={block.language}
                                action={block.action}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t p-4 bg-background">
                <div className="max-w-4xl mx-auto flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask about your code..."
                    className="min-h-[80px] resize-none"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    size="icon"
                    className="h-[80px] w-[80px] flex-shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Send className="h-6 w-6" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <FeedbackDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        onSubmit={submitFeedback}
      />
    </div>
  );
}
