import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SharedHeader } from '@/components/SharedHeader';
import { Plus, Trash2, CheckCircle, XCircle, Star, TrendingUp } from 'lucide-react';

interface TrainingExample {
  id: string;
  model_type: string;
  context: string;
  question: string;
  expected_answer: string;
  do_instructions: string[];
  dont_instructions: string[];
  tags: string[];
  difficulty: string;
  is_approved: boolean;
  created_at: string;
}

interface ModelFeedback {
  id: string;
  model_type: string;
  rating: string;
  feedback_text: string;
  expected_answer: string;
  actual_answer: string;
  is_converted_to_training: boolean;
  created_at: string;
}

export function TrainingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [feedback, setFeedback] = useState<ModelFeedback[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newExample, setNewExample] = useState({
    model_type: 'manual_troubleshooting',
    context: '',
    question: '',
    expected_answer: '',
    do_instructions: '',
    dont_instructions: '',
    tags: '',
    difficulty: 'medium'
  });

  useEffect(() => {
    loadTrainingData();
  }, []);

  const loadTrainingData = async () => {
    const { data: examplesData } = await supabase
      .from('training_examples')
      .select('*')
      .order('created_at', { ascending: false });
    
    const { data: feedbackData } = await supabase
      .from('model_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (examplesData) setExamples(examplesData);
    if (feedbackData) setFeedback(feedbackData);
  };

  const createExample = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('training_examples')
      .insert({
        user_id: user.id,
        model_type: newExample.model_type,
        context: newExample.context,
        question: newExample.question,
        expected_answer: newExample.expected_answer,
        do_instructions: newExample.do_instructions.split('\n').filter(s => s.trim()),
        dont_instructions: newExample.dont_instructions.split('\n').filter(s => s.trim()),
        tags: newExample.tags.split(',').map(s => s.trim()).filter(s => s),
        difficulty: newExample.difficulty,
        is_approved: false
      });

    if (error) {
      toast({ title: 'Error', description: 'Failed to create training example', variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: 'Training example created' });
    setShowCreateDialog(false);
    setNewExample({
      model_type: 'manual_troubleshooting',
      context: '',
      question: '',
      expected_answer: '',
      do_instructions: '',
      dont_instructions: '',
      tags: '',
      difficulty: 'medium'
    });
    loadTrainingData();
  };

  const approveExample = async (id: string) => {
    const { error } = await supabase
      .from('training_examples')
      .update({ is_approved: true })
      .eq('id', id);

    if (!error) {
      toast({ title: 'Approved', description: 'Training example approved' });
      loadTrainingData();
    }
  };

  const convertFeedbackToTraining = async (feedbackItem: ModelFeedback) => {
    if (!user) return;

    const { error } = await supabase
      .from('training_examples')
      .insert({
        user_id: user.id,
        model_type: feedbackItem.model_type,
        context: 'Converted from user feedback',
        question: 'Based on user feedback',
        expected_answer: feedbackItem.expected_answer || feedbackItem.feedback_text,
        do_instructions: ['Provide clear answers', 'Use examples'],
        dont_instructions: ['Be vague', 'Ignore context'],
        tags: ['feedback-converted'],
        difficulty: 'medium',
        is_approved: false
      });

    if (!error) {
      await supabase
        .from('model_feedback')
        .update({ is_converted_to_training: true })
        .eq('id', feedbackItem.id);

      toast({ title: 'Success', description: 'Converted feedback to training example' });
      loadTrainingData();
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'poor': return 'bg-orange-500';
      case 'terrible': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Model Training Dashboard" showBackButton={true} backTo="/" />
      
      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Examples</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{examples.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {examples.filter(e => e.is_approved).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Feedback Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{feedback.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {feedback.length > 0 ? (
                    <>
                      {(feedback.filter(f => f.rating === 'excellent' || f.rating === 'good').length / feedback.length * 100).toFixed(0)}%
                    </>
                  ) : 'N/A'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="examples">
            <TabsList>
              <TabsTrigger value="examples">Training Examples</TabsTrigger>
              <TabsTrigger value="feedback">User Feedback</TabsTrigger>
            </TabsList>

            <TabsContent value="examples" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Training Examples</h2>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Example
                </Button>
              </div>

              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {examples.map(example => (
                    <Card key={example.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">{example.question}</CardTitle>
                            <CardDescription className="flex gap-2 flex-wrap">
                              <Badge variant="outline">{example.model_type}</Badge>
                              <Badge variant="outline">{example.difficulty}</Badge>
                              {example.tags.map(tag => (
                                <Badge key={tag} variant="secondary">{tag}</Badge>
                              ))}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            {example.is_approved ? (
                              <Badge className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            ) : (
                              <Button size="sm" onClick={() => approveExample(example.id)}>
                                Approve
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm font-semibold">Expected Answer:</Label>
                          <p className="text-sm mt-1">{example.expected_answer}</p>
                        </div>
                        {example.do_instructions.length > 0 && (
                          <div>
                            <Label className="text-sm font-semibold">DO:</Label>
                            <ul className="list-disc list-inside text-sm mt-1 text-green-600">
                              {example.do_instructions.map((instruction, idx) => (
                                <li key={idx}>{instruction}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {example.dont_instructions.length > 0 && (
                          <div>
                            <Label className="text-sm font-semibold">DON'T:</Label>
                            <ul className="list-disc list-inside text-sm mt-1 text-red-600">
                              {example.dont_instructions.map((instruction, idx) => (
                                <li key={idx}>{instruction}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4">
              <h2 className="text-2xl font-bold">User Feedback</h2>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {feedback.map(item => (
                    <Card key={item.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge className={getRatingColor(item.rating)}>
                                {item.rating.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">{item.model_type}</Badge>
                              {item.is_converted_to_training && (
                                <Badge variant="secondary">
                                  <Star className="h-3 w-3 mr-1" />
                                  Converted
                                </Badge>
                              )}
                            </div>
                            <CardDescription>
                              {new Date(item.created_at).toLocaleString()}
                            </CardDescription>
                          </div>
                          {!item.is_converted_to_training && (
                            <Button size="sm" onClick={() => convertFeedbackToTraining(item)}>
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Convert to Training
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {item.feedback_text && (
                          <div>
                            <Label className="text-sm font-semibold">Feedback:</Label>
                            <p className="text-sm mt-1">{item.feedback_text}</p>
                          </div>
                        )}
                        {item.expected_answer && (
                          <div>
                            <Label className="text-sm font-semibold">Expected Answer:</Label>
                            <p className="text-sm mt-1">{item.expected_answer}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Training Example</DialogTitle>
            <DialogDescription>
              Add a new training example to improve model performance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Model Type</Label>
              <Select value={newExample.model_type} onValueChange={(value) => setNewExample({ ...newExample, model_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="code_assistant">Code Assistant</SelectItem>
                  <SelectItem value="manual_troubleshooting">Manual Troubleshooting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Context</Label>
              <Textarea
                value={newExample.context}
                onChange={(e) => setNewExample({ ...newExample, context: e.target.value })}
                placeholder="Provide context for this example..."
                className="min-h-[80px]"
              />
            </div>

            <div>
              <Label>Question</Label>
              <Input
                value={newExample.question}
                onChange={(e) => setNewExample({ ...newExample, question: e.target.value })}
                placeholder="What is the user asking?"
              />
            </div>

            <div>
              <Label>Expected Answer</Label>
              <Textarea
                value={newExample.expected_answer}
                onChange={(e) => setNewExample({ ...newExample, expected_answer: e.target.value })}
                placeholder="What should the model respond?"
                className="min-h-[120px]"
              />
            </div>

            <div>
              <Label>DO Instructions (one per line)</Label>
              <Textarea
                value={newExample.do_instructions}
                onChange={(e) => setNewExample({ ...newExample, do_instructions: e.target.value })}
                placeholder="Be specific&#10;Use examples&#10;Cite sources"
                className="min-h-[80px]"
              />
            </div>

            <div>
              <Label>DON'T Instructions (one per line)</Label>
              <Textarea
                value={newExample.dont_instructions}
                onChange={(e) => setNewExample({ ...newExample, dont_instructions: e.target.value })}
                placeholder="Don't be vague&#10;Don't make assumptions&#10;Don't ignore context"
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={newExample.tags}
                  onChange={(e) => setNewExample({ ...newExample, tags: e.target.value })}
                  placeholder="troubleshooting, hardware, motors"
                />
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select value={newExample.difficulty} onValueChange={(value) => setNewExample({ ...newExample, difficulty: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createExample}>
              Create Example
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
