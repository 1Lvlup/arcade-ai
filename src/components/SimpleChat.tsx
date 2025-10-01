import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  grading?: {
    overall: 'PASS' | 'PARTIAL' | 'FAIL';
    score: Record<string, 'PASS' | 'PARTIAL' | 'FAIL'>;
    missing_keywords?: string[];
    evidence_pages?: string[];
    rationale?: string;
  };
  metadata?: {
    manual_id: string;
    embedding_model: string;
    retrieval_strategy: string;
    candidate_count: number;
    rerank_scores: (number | null)[];
    answerability_passed: boolean;
    sources_used: any[];
  };
  context_seen?: string;
}

interface SimpleChatProps {
  manualId?: string;
}

export function SimpleChat({ manualId }: SimpleChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedContext, setExpandedContext] = useState<number | null>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-manual', {
        body: { query: input, manual_id: manualId }
      });

      if (error) throw error;

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.response || 'Sorry, I could not generate a response.',
        grading: data.grading,
        metadata: data.metadata,
        context_seen: data.context_seen
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
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      message.role === 'user' ? 'bg-white/60' : 'bg-primary/60'
                    }`}></div>
                    <span className={`font-mono text-xs ${
                      message.role === 'user' ? 'text-white/70' : 'text-muted-foreground'
                    }`}>
                      {message.role === 'user' ? 'USER' : 'AI ASSISTANT'}
                    </span>
                  </div>
                  {message.role === 'assistant' && message.grading && (
                    <div 
                      className={`px-2 py-1 rounded text-xs font-mono border ${
                        message.grading.overall === 'PASS' 
                          ? 'bg-green-500/10 text-green-500 border-green-500/30' 
                          : message.grading.overall === 'PARTIAL'
                          ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                          : 'bg-red-500/10 text-red-500 border-red-500/30'
                      }`}
                      title={message.grading.rationale}
                    >
                      {message.grading.overall}
                    </div>
                  )}
                </div>

                {/* Metadata & Context Toggle */}
                {message.role === 'assistant' && message.metadata && (
                  <div className="mt-3 pt-3 border-t border-primary/10">
                    <button
                      onClick={() => setExpandedContext(expandedContext === index ? null : index)}
                      className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                    >
                      {expandedContext === index ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      View Context & Metadata
                    </button>
                    
                    {expandedContext === index && (
                      <div className="mt-2 space-y-2 text-xs font-mono">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground">Manual:</span>
                            <span className="ml-2 text-foreground">{message.metadata.manual_id}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Strategy:</span>
                            <span className="ml-2 text-foreground">{message.metadata.retrieval_strategy}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Candidates:</span>
                            <span className="ml-2 text-foreground">{message.metadata.candidate_count}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Answerability:</span>
                            <span className={`ml-2 ${message.metadata.answerability_passed ? 'text-green-500' : 'text-red-500'}`}>
                              {message.metadata.answerability_passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-muted-foreground">Rerank Scores (top 10):</span>
                          <div className="ml-2 text-foreground">
                            {message.metadata.rerank_scores.map((score, i) => (
                              <span key={i} className="mr-2">
                                {score !== null ? score.toFixed(3) : 'N/A'}
                              </span>
                            ))}
                          </div>
                        </div>

                        {message.context_seen && (
                          <div className="mt-2">
                            <span className="text-muted-foreground">Context GPT Saw:</span>
                            <div className="mt-1 p-2 bg-background/50 rounded border border-primary/20 max-h-64 overflow-y-auto text-foreground whitespace-pre-wrap">
                              {message.context_seen}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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