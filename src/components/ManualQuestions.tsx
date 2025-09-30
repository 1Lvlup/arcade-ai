import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Brain, MessageCircle, RefreshCw, Plus, Sparkles } from 'lucide-react';

interface GoldenQuestion {
  id: string;
  question: string;
  category: string;
  importance: string;
  created_at: string;
}

interface ManualQuestionsProps {
  manualId: string;
}

export function ManualQuestions({ manualId }: ManualQuestionsProps) {
  const [questions, setQuestions] = useState<GoldenQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const fetchQuestions = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('golden_questions')
        .select('*')
        .eq('manual_id', manualId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast({
        title: 'Error loading questions',
        description: 'Failed to load golden questions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [manualId, toast]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const generateQuestions = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-golden-questions', {
        body: { manual_id: manualId }
      });

      if (error) throw error;

      toast({
        title: 'Questions generated',
        description: `Generated ${data.questions?.length || 0} golden questions`,
      });
      
      fetchQuestions(); // Refresh the list
    } catch (error) {
      console.error('Error generating questions:', error);
      toast({
        title: 'Error generating questions',
        description: 'Failed to generate golden questions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'troubleshooting': return 'bg-red-100 text-red-800';
      case 'setup': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-green-100 text-green-800';
      case 'safety': return 'bg-yellow-100 text-yellow-800';
      case 'specifications': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance.toLowerCase()) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-purple-900">
            <Brain className="h-6 w-6" />
            <span>Golden Questions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            <span className="ml-3 text-gray-600">Loading questions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2 text-purple-900">
            <Brain className="h-6 w-6" />
            <span>Golden Questions</span>
            <Badge variant="secondary">{questions.length}</Badge>
          </CardTitle>
          <Button 
            onClick={generateQuestions}
            disabled={generating}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Questions
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {questions.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="h-16 w-16 mx-auto mb-4 text-purple-300" />
            <h3 className="text-xl font-semibold text-purple-900 mb-2">No Golden Questions Yet</h3>
            <p className="text-purple-600 mb-6">
              Generate AI-powered questions that help users get the most value from this manual.
            </p>
            <Button 
              onClick={generateQuestions}
              disabled={generating}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
            >
              {generating ? (
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Plus className="h-5 w-5 mr-2" />
              )}
              Generate Golden Questions
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question) => (
              <Card key={question.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Badge className={getCategoryColor(question.category)}>
                        {question.category}
                      </Badge>
                      <div className={`w-3 h-3 rounded-full ${getImportanceColor(question.importance)}`} 
                           title={`${question.importance} importance`}>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        // TODO: Navigate to chat with pre-filled question
                        const searchParams = new URLSearchParams({
                          manual_id: manualId,
                          question: question.question
                        });
                        window.open(`/?chat=true&${searchParams.toString()}`, '_blank');
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-gray-800 font-medium text-lg leading-relaxed">
                    {question.question}
                  </p>
                  <div className="mt-3 text-sm text-gray-500">
                    Generated {new Date(question.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}