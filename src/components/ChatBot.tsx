import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ManualSelector } from '@/components/ManualSelector';
import { 
  MessageCircle, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type OpenAIMessage = { role: 'user' | 'assistant'; content: string };

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  searchResults?: SearchResult[]; // reserved for future: showing sources/figures
}

interface SearchResult {
  id: string;
  content: string;
  manual_id: string;
  manual_title: string;
  page_start?: number;
  page_end?: number;
  menu_path?: string;
  similarity: number;
  content_type: 'text' | 'figure';
  image_available?: boolean;
}

interface ChatBotProps {
  selectedManualId?: string;
  manualTitle?: string;
}

function toOpenAIMessages(chat: ChatMessage[]): OpenAIMessage[] {
  return chat
    .filter(m => m.type === 'user' || m.type === 'bot')
    .map(m => ({
      role: m.type === 'user' ? 'user' : 'assistant',
      content: m.content
    }));
}

export function ChatBot({ selectedManualId: initialManualId, manualTitle: initialManualTitle }: ChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string | null>(initialManualId || null);
  const [manualTitle, setManualTitle] = useState<string | null>(initialManualTitle || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const updateWelcomeMessage = () => {
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      type: 'bot',
      content: selectedManualId 
        ? `Hi! I'm your Arcade Fix Guru assistant. I'll help you troubleshoot issues with "${manualTitle}". What problem are you experiencing?`
        : `Hi! I'm your Arcade Fix Guru assistant. I'll search through all your uploaded manuals to help you troubleshoot arcade machine issues. What can I help you with today?`,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  };

  useEffect(() => {
    updateWelcomeMessage();
  }, [selectedManualId, manualTitle]);

  const handleManualChange = (newManualId: string | null, newManualTitle: string | null) => {
    setSelectedManualId(newManualId);
    setManualTitle(newManualTitle);
    setMessages([]); // clear chat when switching manuals
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // OPTIONAL: ensure the user is logged in if your function requires auth
      // const { data: { session } } = await supabase.auth.getSession();
      // if (!session) { /* prompt login */ }

      // Prepare OpenAI-style messages for the edge function
      const convo = toOpenAIMessages([...messages, userMessage]);

      // —— THIS IS “CALLING THE EDGE FUNCTION” ——
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: {
          messages: convo,                         // [{ role: 'user'|'assistant', content: '...' }]
          manual_id: selectedManualId ?? null      // scope to one manual if selected
        },
      });

      if (error) {
        throw new Error(error.message || JSON.stringify(error));
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: data?.answer ?? 'Sorry—I couldn’t generate a response.',
        timestamp: new Date(),
        // If your edge function later returns sources/figures, attach here:
        // searchResults: data.sources ?? undefined
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      console.error('chat-assistant failed:', err);
      toast({
        title: 'Error',
        description: 'Failed to process your question. Please try again.',
        variant: 'destructive',
      });
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'I hit an error talking to the assistant. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="border-primary/20 h-[600px] flex flex-col">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span>Arcade Fix Guru Assistant</span>
          </div>
          <ManualSelector 
            selectedManualId={selectedManualId} 
            onManualChange={handleManualChange}
          />
        </CardTitle>
        {selectedManualId && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              Searching: {manualTitle}
            </Badge>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  {message.type === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>

                {/* (Optional) Sources block — wire up later when your function returns sources */}
                {message.searchResults && message.searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium opacity-70">
                      Sources ({message.searchResults.length})
                    </div>
                    {message.searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="text-xs p-2 bg-background/50 rounded border border-border"
                      >
                        <div className="flex items-center space-x-1 mb-1">
                          {result.content_type === 'figure' ? (
                            <ImageIcon className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          <span className="font-medium">{result.manual_title}</span>
                          {result.page_start && (
                            <span className="text-muted-foreground">
                              Page {result.page_start}
                            </span>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(result.similarity * 100)}% match
                          </Badge>
                        </div>
                        {result.menu_path && (
                          <div className="text-muted-foreground mb-1">
                            {result.menu_path}
                          </div>
                        )}
                        <div className="text-muted-foreground">
                          {result.content.length > 150 
                            ? `${result.content.slice(0, 150)}...` 
                            : result.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="border-t border-border p-4">
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about arcade machine troubleshooting..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Press Enter to send • Shift+Enter for new line
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
