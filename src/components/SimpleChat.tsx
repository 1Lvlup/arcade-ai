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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Manual Chat Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messages */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-auto max-w-[80%]'
                  : 'bg-muted text-muted-foreground mr-auto max-w-[80%]'
              }`}
            >
              {message.content}
            </div>
          ))}
          {isLoading && (
            <div className="bg-muted text-muted-foreground mr-auto max-w-[80%] p-3 rounded-lg">
              Thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your arcade manuals..."
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
            Send
          </Button>
        </div>

        {messages.length === 0 && (
          <div className="text-center text-muted-foreground">
            Upload a manual first, then ask me anything about arcade game troubleshooting!
          </div>
        )}
      </CardContent>
    </Card>
  );
}