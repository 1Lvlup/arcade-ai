import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function SimpleChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-manual', {
        body: { query: input }
      });

      if (error) throw error;

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.response || 'Sorry, I could not generate a response.' 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Messages Container */}
        <div className="min-h-[400px] max-h-[600px] overflow-y-auto space-y-4 p-6 rounded-xl tech-card bg-gradient-tech custom-scrollbar">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-xl font-body ${
                  message.role === 'user'
                    ? 'gradient-orange text-white shadow-orange ml-auto border border-primary/20'
                    : 'tech-card text-foreground border-tech mr-auto'
                }`}
              >
                <div className="text-sm leading-relaxed">
                  {message.content}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    message.role === 'user' ? 'bg-white/60' : 'bg-primary/60'
                  }`}></div>
                  <span className={`font-mono text-xs ${
                    message.role === 'user' ? 'text-white/70' : 'text-muted-foreground'
                  }`}>
                    {message.role === 'user' ? 'USER' : 'AI ASSISTANT'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="tech-card text-foreground border-tech max-w-[80%] p-4 rounded-xl mr-auto">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                  <span className="font-mono text-sm text-primary">AI PROCESSING...</span>
                </div>
              </div>
            </div>
          )}
          
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="tech-card p-8 max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <div className="text-2xl">🤖</div>
                </div>
                <div className="text-tech-lg text-primary mb-3 text-glow">AI READY</div>
                <div className="font-body text-muted-foreground text-center">
                  Query the technical documentation for troubleshooting procedures, 
                  component specifications, or repair instructions.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Interface */}
        <div className="tech-card p-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter technical query or troubleshooting request..."
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading}
                className="bg-background/80 border-primary/30 focus:border-primary font-body placeholder:text-muted-foreground/60"
              />
            </div>
            <Button 
              onClick={handleSend} 
              disabled={isLoading || !input.trim()}
              className="btn-tech px-6"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  SEND
                </div>
              ) : (
                <div className="flex items-center gap-2 font-tech">
                  🚀 EXECUTE
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}