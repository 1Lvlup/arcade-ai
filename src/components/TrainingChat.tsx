import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Send, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface FeedbackIssue {
  id: string;
  label: string;
}

const FEEDBACK_ISSUES: FeedbackIssue[] = [
  { id: 'hallucinated_numbers', label: 'Hallucinated Numbers' },
  { id: 'not_enough_detail', label: "Didn't Give Enough Detail" },
  { id: 'poor_structure', label: "Structure Wasn't the Best" },
  { id: 'wrong_page_refs', label: 'Wrong Page References' },
  { id: 'missed_context', label: 'Missed Context' },
  { id: 'too_verbose', label: 'Too Verbose' },
  { id: 'unclear', label: 'Unclear/Confusing' },
];

export function TrainingChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedRating, setSelectedRating] = useState<'good' | 'bad' | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [lastAssistantMessage, setLastAssistantMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !user) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowFeedback(false);

    try {
      const { data, error } = await supabase.functions.invoke('chat-manual', {
        body: {
          messages: [...messages, userMessage],
          manual_id: null // Training mode - can search all manuals
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer || 'No response generated'
      };

      setMessages(prev => [...prev, assistantMessage]);
      setLastAssistantMessage(assistantMessage.content);
      setShowFeedback(true);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get response',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!selectedRating || !user) return;

    const feedbackText = selectedIssues.length > 0
      ? `Issues: ${selectedIssues.join(', ')}${feedbackNotes ? `\n\nNotes: ${feedbackNotes}` : ''}`
      : feedbackNotes;

    try {
      const { error } = await supabase
        .from('model_feedback')
        .insert([{
          model_type: 'manual_troubleshooting',
          rating: selectedRating === 'good' ? 'good' : 'poor',
          feedback_text: feedbackText,
          actual_answer: lastAssistantMessage,
          context: JSON.parse(JSON.stringify({
            selected_issues: selectedIssues,
            messages: messages.slice(-4).map(m => ({ role: m.role, content: m.content }))
          }))
        }]);

      if (error) throw error;

      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for helping improve the model!',
      });

      // Reset feedback form
      setShowFeedback(false);
      setSelectedRating(null);
      setSelectedIssues([]);
      setFeedbackNotes('');
    } catch (error) {
      console.error('Feedback error:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit feedback',
        variant: 'destructive',
      });
    }
  };

  const toggleIssue = (issueId: string) => {
    setSelectedIssues(prev =>
      prev.includes(issueId)
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId]
    );
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle>Train Your Answer Model</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask a question about your manuals..."
              className="min-h-[60px]"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {showFeedback && (
        <Card>
          <CardHeader>
            <CardTitle>Rate This Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={selectedRating === 'good' ? 'default' : 'outline'}
                onClick={() => setSelectedRating('good')}
                className="flex-1"
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Good Response
              </Button>
              <Button
                variant={selectedRating === 'bad' ? 'destructive' : 'outline'}
                onClick={() => setSelectedRating('bad')}
                className="flex-1"
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Needs Improvement
              </Button>
            </div>

            {selectedRating === 'bad' && (
              <>
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">What was wrong?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {FEEDBACK_ISSUES.map((issue) => (
                      <div key={issue.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={issue.id}
                          checked={selectedIssues.includes(issue.id)}
                          onCheckedChange={() => toggleIssue(issue.id)}
                        />
                        <label
                          htmlFor={issue.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {issue.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder="Explain what should have been different..."
                    className="min-h-[100px]"
                  />
                </div>
              </>
            )}

            {selectedRating === 'good' && (
              <div>
                <Label htmlFor="notes">What made this response good? (optional)</Label>
                <Textarea
                  id="notes"
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="Share what you liked..."
                  className="min-h-[80px]"
                />
              </div>
            )}

            <Button
              onClick={submitFeedback}
              disabled={!selectedRating}
              className="w-full"
            >
              Submit Feedback
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
