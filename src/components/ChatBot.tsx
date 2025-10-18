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
  CheckCircle2,
  Lightbulb,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AnswerStep {
  step: string;
  expected?: string;
  source?: 'manual' | 'expert';
}

interface AnswerSource {
  page: number;
  note: string;
}

interface StructuredAnswer {
  summary: string;
  steps?: AnswerStep[];
  why?: string[];
  expert_advice?: string[];
  safety?: string[];
  sources?: AnswerSource[];
}

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string | StructuredAnswer;
  timestamp: Date;
  query_log_id?: string;
  feedback?: 'thumbs_up' | 'thumbs_down' | null;
}

interface ChatBotProps {
  selectedManualId?: string;
  manualTitle?: string;
}

export function ChatBot({ selectedManualId: initialManualId, manualTitle: initialManualTitle }: ChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string | null>(initialManualId || null);
  const [manualTitle, setManualTitle] = useState<string | null>(initialManualTitle || null);
  const [expandedSources, setExpandedSources] = useState<string | null>(null);
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
    const query = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Create placeholder bot message
    const botMessageId = (Date.now() + 1).toString();
    const botMessage: ChatMessage = {
      id: botMessageId,
      type: 'bot',
      content: '',
      timestamp: new Date(),
      feedback: null
    };
    setMessages(prev => [...prev, botMessage]);

    try {
      console.log('📤 Sending streaming message to chat-manual:', { 
        query, 
        manual_id: selectedManualId 
      });

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-manual`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            query,
            manual_id: selectedManualId ?? null,
            stream: true
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content') {
                accumulatedContent += parsed.data;
                setMessages(prev => prev.map(msg => 
                  msg.id === botMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              } else if (parsed.type === 'metadata') {
                console.log('📊 Received metadata:', parsed.data);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

      console.log('✅ Streaming complete');
    } catch (err: any) {
      console.error('❌ chat-manual failed:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to process your question. Please try again.',
        variant: 'destructive',
      });
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { ...msg, content: `Error: ${err.message || 'I hit an error talking to the assistant. Please try again.'}` }
          : msg
      ));
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

  const handleFeedback = async (messageId: string, rating: 'thumbs_up' | 'thumbs_down') => {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.type !== 'bot' || !message.query_log_id) return;

    try {
      const { error } = await supabase.from('model_feedback').insert({
        query_log_id: message.query_log_id,
        rating: rating === 'thumbs_up' ? 'excellent' : 'poor',
        model_type: 'manual_troubleshooting',
        actual_answer: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
      });

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, feedback: rating } : msg
      ));

      toast({
        title: 'Feedback recorded',
        description: rating === 'thumbs_up' ? 'Thanks for the positive feedback!' : 'Thanks for the feedback, we\'ll work to improve.',
      });
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to save feedback',
        variant: 'destructive',
      });
    }
  };

  const isStructuredAnswer = (content: any): content is StructuredAnswer => {
    return typeof content === 'object' && content !== null && 'summary' in content;
  };

  const renderStructuredAnswer = (answer: StructuredAnswer, messageId: string) => (
    <div className="space-y-3">
      {/* Summary */}
      <div className="text-sm leading-relaxed">
        {answer.summary}
      </div>

      {/* Steps as Checklist */}
      {answer.steps && answer.steps.length > 0 && (
        <div className="space-y-2">
          <div className="font-semibold text-xs text-primary uppercase tracking-wider">Procedure</div>
          {answer.steps.map((stepItem, i) => (
            <div key={i} className="flex gap-2 items-start">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-sm">{stepItem.step}</span>
                  {stepItem.source && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        stepItem.source === 'manual' 
                          ? 'bg-green-500/10 text-green-500 border-green-500/30' 
                          : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                      }`}
                    >
                      {stepItem.source}
                    </Badge>
                  )}
                </div>
                {stepItem.expected && (
                  <div className="text-xs text-muted-foreground">
                    Expected: {stepItem.expected}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Why Explanation */}
      {answer.why && answer.why.length > 0 && (
        <div className="space-y-2">
          <div className="font-semibold text-xs text-primary uppercase tracking-wider">Why This Works</div>
          {answer.why.map((reason, i) => (
            <div key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/20">
              {reason}
            </div>
          ))}
        </div>
      )}

      {/* Expert Advice / Pro Tips */}
      {answer.expert_advice && answer.expert_advice.length > 0 && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-blue-500 uppercase tracking-wider">
            <Lightbulb className="h-4 w-4" />
            Pro Tips
          </div>
          {answer.expert_advice.map((tip, i) => (
            <div key={i} className="text-sm">
              • {tip}
            </div>
          ))}
        </div>
      )}

      {/* Safety Warnings */}
      {answer.safety && answer.safety.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-primary uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4" />
            Safety
          </div>
          {answer.safety.map((warning, i) => (
            <div key={i} className="text-sm">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      {/* Sources Toggle */}
      {answer.sources && answer.sources.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setExpandedSources(expandedSources === messageId ? null : messageId)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {expandedSources === messageId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <FileText size={14} />
            View Sources ({answer.sources.length})
          </button>
          
          {expandedSources === messageId && (
            <div className="mt-2 space-y-2">
              {answer.sources.map((source, i) => (
                <div key={i} className="text-xs p-2 bg-background/50 rounded border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      Page {source.page}
                    </Badge>
                    <span className="text-muted-foreground">{source.note}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Card className="border-primary/20 h-full flex flex-col">
      <CardHeader className="border-b border-border flex-shrink-0 py-3 px-4">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="tracking-wider font-bold">LEVEL UP</span>
          <ManualSelector 
            selectedManualId={selectedManualId} 
            onManualChange={handleManualChange}
          />
        </CardTitle>
        {selectedManualId && (
          <div className="mt-1">
            <Badge variant="outline" className="text-xs">
              Searching: {manualTitle}
            </Badge>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-black">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 font-sans ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {message.type === 'user' && (
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="h-4 w-4" />
                    <span className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                )}
                
                {message.type === 'user' ? (
                  <div className="text-sm whitespace-pre-wrap">{message.content as string}</div>
                ) : isStructuredAnswer(message.content) ? (
                  renderStructuredAnswer(message.content, message.id)
                ) : (
                  <div className="text-sm whitespace-pre-wrap">
                    {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                  </div>
                )}

                {/* Thumbs Up/Down for Bot Messages */}
                {message.type === 'bot' && (
                  <div className="mt-3 pt-3 border-t border-primary/10 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-2">Was this helpful?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback(message.id, 'thumbs_up')}
                      disabled={message.feedback !== null}
                      className={`h-8 px-3 ${
                        message.feedback === 'thumbs_up' 
                          ? 'bg-green-500/20 text-green-500 border border-green-500/30' 
                          : 'hover:bg-green-500/10 hover:text-green-500'
                      }`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback(message.id, 'thumbs_down')}
                      disabled={message.feedback !== null}
                      className={`h-8 px-3 ${
                        message.feedback === 'thumbs_down' 
                          ? 'bg-red-500/20 text-red-500 border border-red-500/30' 
                          : 'hover:bg-red-500/10 hover:text-red-500'
                      }`}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
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
        <div className="border-t border-border p-4 flex-shrink-0">
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
