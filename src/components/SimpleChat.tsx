import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronUp, CheckCircle2, Lightbulb, FileText, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

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

interface Message {
  role: 'user' | 'assistant';
  content: string | StructuredAnswer;
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
  query_log_id?: string;
  feedback?: 'thumbs_up' | 'thumbs_down' | null;
}

interface SimpleChatProps {
  manualId?: string;
}

export function SimpleChat({ manualId }: SimpleChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedContext, setExpandedContext] = useState<number | null>(null);
  const [expandedSources, setExpandedSources] = useState<number | null>(null);
  const { toast } = useToast();

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
        content: data.answer || 'Sorry, I could not generate a response.',
        grading: data.grading,
        metadata: data.metadata,
        context_seen: data.context_seen,
        query_log_id: data.query_log_id,
        feedback: null
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

  const handleFeedback = async (index: number, rating: 'thumbs_up' | 'thumbs_down') => {
    const message = messages[index];
    if (message.role !== 'assistant' || !message.query_log_id) return;

    try {
      const { error } = await supabase.from('model_feedback').insert({
        query_log_id: message.query_log_id,
        rating: rating === 'thumbs_up' ? 'excellent' : 'poor',
        model_type: 'manual_troubleshooting',
        actual_answer: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
        context: message.metadata
      });

      if (error) throw error;

      // Update the message feedback state
      setMessages(prev => prev.map((msg, i) => 
        i === index ? { ...msg, feedback: rating } : msg
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

  const renderStructuredAnswer = (answer: StructuredAnswer, index: number) => (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-base leading-relaxed">
        {answer.summary}
      </div>

      {/* Steps as Checklist */}
      {answer.steps && answer.steps.length > 0 && (
        <div className="space-y-2">
          <div className="font-tech text-xs text-primary uppercase tracking-wider">Procedure</div>
          {answer.steps.map((stepItem, i) => (
            <div key={i} className="flex gap-3 items-start">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-base">{stepItem.step}</span>
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
                  <div className="text-sm text-muted-foreground">
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
          <div className="font-tech text-sm text-primary uppercase tracking-wider">Why This Works</div>
          {answer.why.map((reason, i) => (
            <div key={i} className="text-base text-muted-foreground pl-4 border-l-2 border-primary/20">
              {reason}
            </div>
          ))}
        </div>
      )}

      {/* Expert Advice / Pro Tips */}
      {answer.expert_advice && answer.expert_advice.length > 0 && (
        <div className="tech-card bg-blue-500/5 border-blue-500/20 p-4 space-y-2">
          <div className="flex items-center gap-2 font-tech text-sm text-blue-500 uppercase tracking-wider">
            <Lightbulb className="h-4 w-4" />
            Pro Tips
          </div>
          {answer.expert_advice.map((tip, i) => (
            <div key={i} className="text-base text-foreground">
              • {tip}
            </div>
          ))}
        </div>
      )}

      {/* Safety Warnings */}
      {answer.safety && answer.safety.length > 0 && (
        <div className="tech-card bg-primary/5 border-primary/20 p-4 space-y-2">
          <div className="flex items-center gap-2 font-tech text-sm text-primary uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4" />
            Safety
          </div>
          {answer.safety.map((warning, i) => (
            <div key={i} className="text-base text-foreground">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      {/* Sources Toggle */}
      {answer.sources && answer.sources.length > 0 && (
        <div className="border-t border-primary/10 pt-3">
          <button
            onClick={() => setExpandedSources(expandedSources === index ? null : index)}
            className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
          >
            {expandedSources === index ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <FileText size={14} />
            View Sources ({answer.sources.length})
          </button>
          
          {expandedSources === index && (
            <div className="mt-2 space-y-2">
              {answer.sources.map((source, i) => (
                <div key={i} className="text-xs p-2 tech-card bg-background/50">
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
    <div className="w-full max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Messages Container */}
        <div className="min-h-[400px] max-h-[600px] overflow-y-auto space-y-4 p-6 rounded-xl bg-black custom-scrollbar">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-xl ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto border border-primary/20 font-sans'
                    : 'tech-card text-foreground border-tech mr-auto font-sans'
                }`}
              >
                {message.role === 'user' ? (
                  <div className="text-base leading-relaxed">
                    {message.content as string}
                  </div>
                ) : isStructuredAnswer(message.content) ? (
                  renderStructuredAnswer(message.content, index)
                ) : (
                  <div className="text-base leading-relaxed">
                    {message.content as string}
                  </div>
                )}

                {/* Thumbs Up/Down Buttons for Assistant Messages */}
                {message.role === 'assistant' && (
                  <div className="mt-3 pt-3 border-t border-primary/10 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-2">Was this helpful?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback(index, 'thumbs_up')}
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
                      onClick={() => handleFeedback(index, 'thumbs_down')}
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
                
                {message.role === 'user' && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white/60"></div>
                    <span className="font-mono text-xs text-white/70">USER</span>
                  </div>
                )}
                
                {message.role === 'assistant' && message.grading && (
                  <div className="mt-2 flex items-center justify-end">
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
                  </div>
                )}

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