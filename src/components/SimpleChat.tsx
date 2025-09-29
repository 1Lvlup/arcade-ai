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
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        {/* Messages Container */}
        <div className="min-h-[400px] max-h-[600px] overflow-y-auto space-y-4 p-4 rounded-lg border border-primary/20 bg-gradient-to-b from-background to-muted/20">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-lg shadow-lg ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-orange ml-auto'
                    : 'bg-gradient-to-r from-secondary/40 to-muted text-foreground border border-primary/30'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gradient-to-r from-secondary/40 to-muted text-foreground border border-primary/30 max-w-[80%] p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  <span className="text-sm text-primary ml-2">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-primary/60 mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 flex items-center justify-center">
                  <div className="text-2xl">🤖</div>
                </div>
              </div>
              <div className="text-lg font-medium text-primary mb-2">Ready to Help!</div>
              <div className="text-muted-foreground max-w-md mx-auto">
                Ask me anything about arcade game troubleshooting, repairs, or technical issues with your uploaded manuals.
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex gap-3 p-4 rounded-lg border border-primary/30 bg-gradient-to-r from-background to-muted/20 shadow-orange">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about troubleshooting, repairs, or technical issues..."
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
            className="flex-1 border-primary/40 focus:border-primary focus:ring-primary/30 bg-background/80"
          />
          <Button 
            onClick={handleSend} 
            disabled={isLoading || !input.trim()}
            className="gradient-orange shadow-orange hover:shadow-orange-strong transition-all duration-300 px-6"
          >
            {isLoading ? '⏳' : '🚀'} Send
          </Button>
        </div>
      </div>
    </div>
  );
}