import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SharedHeader } from '@/components/SharedHeader';
import { Send, Code, Copy, Bot, User, Sparkles, FileCode, Plus, Trash2, History, MessageSquare, Upload, X, Folder, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CodeFile {
  id: string;
  file_path: string;
  file_content: string;
  language?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function CodeAssistant() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [codeFiles, setCodeFiles] = useState<CodeFile[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
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

  const loadConversations = async () => {
    const { data } = await supabase
      .from('code_assistant_conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (data) setConversations(data);
  };

  const loadConversationData = async () => {
    if (!currentConversation) return;

    // Load messages
    const { data: messagesData } = await supabase
      .from('code_assistant_messages')
      .select('*')
      .eq('conversation_id', currentConversation)
      .order('created_at');

    if (messagesData) {
      setMessages(messagesData.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at)
      })));
    }

    // Load files
    const { data: filesData } = await supabase
      .from('code_assistant_files')
      .select('*')
      .eq('conversation_id', currentConversation);

    if (filesData) setCodeFiles(filesData);
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
    setCodeFiles([]);
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
      setCodeFiles([]);
    }
  };

  const addCodeFile = async () => {
    if (!currentConversation || !newFilePath || !newFileContent) return;

    const { data, error } = await supabase
      .from('code_assistant_files')
      .insert({
        conversation_id: currentConversation,
        file_path: newFilePath,
        file_content: newFileContent,
        language: detectLanguage(newFilePath)
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Failed to add file', variant: 'destructive' });
      return;
    }

    setCodeFiles([...codeFiles, data]);
    setNewFilePath('');
    setNewFileContent('');
    setShowFileDialog(false);
    
    toast({ title: 'File Added', description: `${newFilePath} added to context` });
  };

  const removeCodeFile = async (id: string) => {
    await supabase
      .from('code_assistant_files')
      .delete()
      .eq('id', id);
    
    setCodeFiles(codeFiles.filter(f => f.id !== id));
  };

  const detectLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescript', 'js': 'javascript', 
      'jsx': 'javascript', 'py': 'python', 'css': 'css', 'html': 'html',
      'json': 'json', 'md': 'markdown', 'sql': 'sql'
    };
    return langMap[ext || ''] || 'text';
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentConversation) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save user message to database
    await supabase
      .from('code_assistant_messages')
      .insert({
        conversation_id: currentConversation,
        role: 'user',
        content: input
      });

    try {
      // Build codebase context from files
      const codebaseContext = codeFiles.length > 0 
        ? `# Project Files:\n\n${codeFiles.map(f => `## ${f.file_path}\n\`\`\`${f.language}\n${f.file_content}\n\`\`\``).join('\n\n')}`
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
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message
      await supabase
        .from('code_assistant_messages')
        .insert({
          conversation_id: currentConversation,
          role: 'assistant',
          content: data.message
        });

      // Update conversation timestamp
      await supabase
        .from('code_assistant_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversation);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Code copied to clipboard' });
  };

  if (!currentConversation) {
    return (
      <div className="min-h-screen bg-background">
        <SharedHeader title="AI Code Assistant" showBackButton={true} backTo="/" />
        
        <main className="container mx-auto px-6 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Welcome to AI Code Assistant
              </CardTitle>
              <CardDescription>
                Your personal AI coding partner with full codebase understanding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Features:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✅ Upload your entire codebase for context</li>
                  <li>✅ Persistent conversations with history</li>
                  <li>✅ Generate production-ready code</li>
                  <li>✅ Debug issues with full file context</li>
                  <li>✅ Code review and suggestions</li>
                </ul>
              </div>

              <Button onClick={createNewConversation} className="w-full" size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Start New Conversation
              </Button>

              {conversations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Recent Conversations:</h3>
                  <ScrollArea className="h-[300px]">
                    {conversations.map(conv => (
                      <div key={conv.id} className="flex items-center justify-between p-3 border rounded-lg mb-2 hover:bg-muted/50 cursor-pointer" onClick={() => setCurrentConversation(conv.id)}>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{conv.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(conv.updated_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="AI Code Assistant" showBackButton={true} backTo="/" />
      
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Files & Conversations */}
          <Card className="lg:col-span-1">
            <Tabs defaultValue="files">
              <TabsList className="w-full">
                <TabsTrigger value="files" className="flex-1">
                  <Folder className="h-4 w-4 mr-1" />
                  Files
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1">
                  <History className="h-4 w-4 mr-1" />
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="files" className="p-4 space-y-4">
                <Dialog open={showFileDialog} onOpenChange={setShowFileDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Add File
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Code File</DialogTitle>
                      <DialogDescription>
                        Paste your code files to give the AI full context
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">File Path</label>
                        <Input
                          placeholder="src/components/MyComponent.tsx"
                          value={newFilePath}
                          onChange={(e) => setNewFilePath(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">File Content</label>
                        <Textarea
                          placeholder="Paste your code here..."
                          value={newFileContent}
                          onChange={(e) => setNewFileContent(e.target.value)}
                          className="min-h-[400px] font-mono text-sm"
                        />
                      </div>
                      <Button onClick={addCodeFile} className="w-full">
                        Add File
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {codeFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded-lg bg-muted/50 group">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm truncate" title={file.file_path}>
                            {file.file_path}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCodeFile(file.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {codeFiles.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No files added yet
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="history" className="p-4">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {conversations.map(conv => (
                      <div
                        key={conv.id}
                        className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${currentConversation === conv.id ? 'bg-primary/10 border-primary' : ''}`}
                        onClick={() => setCurrentConversation(conv.id)}
                      >
                        <div className="font-medium text-sm truncate">{conv.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(conv.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button onClick={createNewConversation} className="w-full mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  New Chat
                </Button>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Main Chat */}
          <Card className="lg:col-span-3">
            <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-purple-500/10">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                {conversations.find(c => c.id === currentConversation)?.title}
              </CardTitle>
              <CardDescription>
                {codeFiles.length} file{codeFiles.length !== 1 ? 's' : ''} in context
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px] p-6">
                <div className="space-y-6">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      
                      <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={message.role === 'user' ? 'default' : 'secondary'}>
                            {message.role === 'user' ? 'You' : 'AI'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <div className={`rounded-lg p-4 ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown
                              components={{
                                code: ({ node, inline, className, children, ...props }: any) => {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const codeString = String(children).replace(/\n$/, '');
                                  
                                  return !inline && match ? (
                                    <div className="relative group">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => copyToClipboard(codeString)}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                      <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        {...props}
                                      >
                                        {codeString}
                                      </SyntaxHighlighter>
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
                        </div>
                      </div>

                      {message.role === 'user' && (
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary animate-pulse" />
                      </div>
                      <div className="bg-muted rounded-lg p-4">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              <div className="border-t p-6">
                <div className="flex gap-4">
                  <Textarea
                    placeholder="Ask about your code, request new features, or get debugging help..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="min-h-[80px]"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
