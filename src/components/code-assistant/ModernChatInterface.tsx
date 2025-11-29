import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, User, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ModernChatInterfaceProps {
  messages: Message[];
  onCopyCode: (code: string) => void;
  onFeedback?: (messageId: string, feedback: 'up' | 'down') => void;
}

export function ModernChatInterface({ messages, onCopyCode, onFeedback }: ModernChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[400px] text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Bot className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Start a conversation</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Select files from the sidebar and ask me anything about your codebase.
                I can help with debugging, refactoring, documentation, and more.
              </p>
            </div>
          </div>
        )}

        {messages.map((message, idx) => (
          <div key={idx} className="flex gap-4">
            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
              message.role === 'user' ? 'bg-secondary' : 'bg-primary/10'
            }`}>
              {message.role === 'user' ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4 text-primary" />
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {message.role === 'user' ? 'You' : 'AI Assistant'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <Card className="p-4 bg-card/50 border-border/50">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      code(props) {
                        const { className, children } = props;
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        
                        if (match) {
                          return (
                            <div className="relative group my-4">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                onClick={() => onCopyCode(codeString)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <SyntaxHighlighter
                                language={match[1]}
                                PreTag="div"
                                customStyle={{
                                  margin: 0,
                                  borderRadius: '0.5rem',
                                  fontSize: '0.875rem',
                                }}
                              >
                                {codeString}
                              </SyntaxHighlighter>
                            </div>
                          );
                        }
                        
                        return (
                          <code className="px-1.5 py-0.5 rounded bg-muted text-sm">
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </Card>

              {message.role === 'assistant' && onFeedback && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onFeedback(message.timestamp, 'up')}
                    className="h-7 px-2"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onFeedback(message.timestamp, 'down')}
                    className="h-7 px-2"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
}
