import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SharedHeader } from '@/components/SharedHeader';
import { 
  Plus, 
  Trash2, 
  MessageSquare, 
  Search,
  Settings,
  RefreshCw,
  FolderGit2,
  ChevronLeft,
  ChevronRight,
  Code,
  FileCode
} from 'lucide-react';
import { ChatInput } from '@/components/code-assistant/ChatInput';
import { ModernChatInterface } from '@/components/code-assistant/ModernChatInterface';
import { SimplifiedFileTree } from '@/components/code-assistant/SimplifiedFileTree';
import { SystemArchitectureSelector } from '@/components/code-assistant/SystemArchitectureSelector';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
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
  const { toast } = useToast();
  
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('main');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sourceMode, setSourceMode] = useState<'github' | 'architecture'>('github');

  // Load initial data
  useEffect(() => {
    loadUserSettings();
    loadConversations();
    loadIndexedFiles();
  }, []);

  useEffect(() => {
    if (currentConversation) {
      loadConversationData();
    }
  }, [currentConversation]);

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
    if (!repository) {
      toast({
        title: 'Repository Required',
        description: 'Please configure your GitHub repository in settings',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-github-repo', {
        body: { repository },
      });
      
      if (error) throw error;
      
      if (!data?.files || data.files.length === 0) {
        throw new Error('No files found in repository');
      }

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
        title: 'Sync Complete',
        description: `Indexed ${data.files.length} files from ${repository}`,
      });
    } catch (error: any) {
      console.error('GitHub sync error:', error);
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync with GitHub',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const saveSettings = async () => {
    if (!user || !repository) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({
        github_repository: repository,
        github_branch: branch,
      })
      .eq('user_id', user.id);
    
    if (!error) {
      toast({ title: 'Settings Saved' });
      syncGitHub();
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
    
    if (currentConversation) {
      supabase
        .from('code_assistant_conversations')
        .update({ selected_file_ids: Array.from(newSelection) })
        .eq('id', currentConversation)
        .then();
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || !currentConversation) return;

    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      await supabase
        .from('code_assistant_messages')
        .insert({
          conversation_id: currentConversation,
          role: 'user',
          content: messageText
        });

      const selectedFiles = indexedFiles.filter(f => selectedFileIds.has(f.id));
      const codebaseContext = selectedFiles.map(file => 
        `File: ${file.file_path}\n\`\`\`${file.language || 'plaintext'}\n${file.file_content}\n\`\`\``
      ).join('\n\n');

      const { data, error } = await supabase.functions.invoke('ai-code-assistant', {
        body: {
          messages: messages.map(m => ({ role: m.role, content: m.content })).concat([
            { role: 'user', content: messageText }
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
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <SharedHeader title="AI Code Assistant" showBackButton={true} backTo="/" />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - File Browser */}
        <div className={`${isSidebarCollapsed ? 'w-0' : 'w-80'} flex-shrink-0 border-r border-border bg-card/50 flex flex-col transition-all duration-300 overflow-hidden`}>
          {!isSidebarCollapsed && (
            <>
              {/* Sidebar Header */}
              <div className="p-4 border-b border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Project Files</h2>
                  </div>
                  <div className="flex items-center gap-1">
                    {sourceMode === 'github' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={syncGitHub}
                        disabled={isSyncing}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>GitHub Settings</SheetTitle>
                          <SheetDescription>
                            Configure your GitHub repository to sync code
                          </SheetDescription>
                        </SheetHeader>
                        <div className="space-y-4 mt-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Repository</label>
                            <Input
                              placeholder="owner/repo"
                              value={repository}
                              onChange={(e) => setRepository(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Branch</label>
                            <Input
                              placeholder="main"
                              value={branch}
                              onChange={(e) => setBranch(e.target.value)}
                            />
                          </div>
                          <Button onClick={saveSettings} className="w-full">
                            Save & Sync
                          </Button>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>

                {/* Source Mode Selector */}
                <Select value={sourceMode} onValueChange={(v) => setSourceMode(v as 'github' | 'architecture')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="github">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        <span>GitHub Repository</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="architecture">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4" />
                        <span>System Architecture</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {lastSync && sourceMode === 'github' && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {lastSync.toLocaleTimeString()}
                  </p>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={sourceMode === 'github' ? "Search files..." : "Search features..."}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {sourceMode === 'github' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedFileIds.size} of {indexedFiles.length} selected
                    </span>
                  </div>
                )}
              </div>

              {/* File Tree or Architecture Selector */}
              {sourceMode === 'github' ? (
                <SimplifiedFileTree
                  files={indexedFiles}
                  selectedFileIds={selectedFileIds}
                  onToggleFile={handleToggleFile}
                  searchFilter={searchFilter}
                />
              ) : (
                <SystemArchitectureSelector
                  selectedFileIds={selectedFileIds}
                  onToggleFile={handleToggleFile}
                  searchFilter={searchFilter}
                />
              )}
            </>
          )}
        </div>

        {/* Collapse Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute left-80 top-20 z-10 h-8 w-8 p-0 rounded-full border border-border bg-background shadow-md hover:shadow-lg transition-all"
          style={{ left: isSidebarCollapsed ? '0' : '320px' }}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {!currentConversation ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <Card className="max-w-2xl w-full">
                <CardContent className="pt-8 space-y-8">
                  <div className="text-center space-y-3">
                    <div className="inline-flex p-4 rounded-full bg-primary/10">
                      <MessageSquare className="h-12 w-12 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">Welcome to AI Code Assistant</h2>
                    <p className="text-muted-foreground">
                      Your intelligent pair programmer. Select files from the sidebar and start asking questions about your codebase.
                    </p>
                  </div>

                  <Button onClick={createNewConversation} size="lg" className="w-full">
                    <Plus className="h-5 w-5 mr-2" />
                    Start New Conversation
                  </Button>

                  {conversations.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Recent Conversations</h3>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-2">
                          {conversations.map(conv => (
                            <div
                              key={conv.id}
                              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => setCurrentConversation(conv.id)}
                            >
                              <div className="flex items-center gap-3">
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteConversation(conv.id);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="border-b border-border px-6 py-4 bg-card/50 backdrop-blur-sm">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={createNewConversation}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Chat
                    </Button>
                    <span className="text-sm font-medium">
                      {conversations.find(c => c.id === currentConversation)?.title}
                    </span>
                  </div>
                  <Badge variant="secondary">
                    {selectedFileIds.size} files in context
                  </Badge>
                </div>
              </div>

              {/* Messages */}
              <ModernChatInterface
                messages={messages}
                onCopyCode={copyToClipboard}
              />

              {/* Chat Input */}
              <div className="border-t border-border bg-card/50 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto p-4">
                  <ChatInput
                    onSendMessage={sendMessage}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
