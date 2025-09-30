import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Brain, CheckCircle2, AlertCircle, XCircle, Play, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface EvaluationResult {
  id: string;
  question_id: string;
  answer: string;
  score: 'PASS' | 'PARTIAL' | 'FAIL';
  coverage: string;
  rationale: string;
  missing_keywords: string[];
  citations: any[];
  question: {
    question: string;
    category: string;
    importance: string;
    expected_keywords: string[];
  };
}

interface QualityEvaluationProps {
  manualId: string;
}

export function QualityEvaluation({ manualId }: QualityEvaluationProps) {
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchEvaluations = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('question_evaluations')
        .select(`
          *,
          question:golden_questions(question, category, importance, expected_keywords)
        `)
        .eq('manual_id', manualId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResults((data || []) as EvaluationResult[]);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
    } finally {
      setLoading(false);
    }
  }, [manualId]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  const runEvaluation = async () => {
    setEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-manual', {
        body: { manual_id: manualId }
      });

      if (error) throw error;

      if (toast) {
        toast({
          title: 'Evaluation complete',
          description: `Pass rate: ${data.summary.pass_rate}% (${data.summary.pass}/${data.summary.total})`,
        });
      }

      fetchEvaluations();
    } catch (error) {
      console.error('Error running evaluation:', error);
      if (toast) {
        toast({
          title: 'Evaluation failed',
          description: error instanceof Error ? error.message : 'Failed to evaluate manual',
          variant: 'destructive',
        });
      }
    } finally {
      setEvaluating(false);
    }
  };

  const getScoreIcon = (score: string) => {
    switch (score) {
      case 'PASS': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'PARTIAL': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'FAIL': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const getScoreBadge = (score: string) => {
    const variants = {
      PASS: 'bg-green-500/10 text-green-500 border-green-500/30',
      PARTIAL: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
      FAIL: 'bg-red-500/10 text-red-500 border-red-500/30'
    };
    return variants[score as keyof typeof variants] || '';
  };

  if (loading) {
    return (
      <Card className="bg-card border-primary/30">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = {
    total: results.length,
    pass: results.filter(r => r.score === 'PASS').length,
    partial: results.filter(r => r.score === 'PARTIAL').length,
    fail: results.filter(r => r.score === 'FAIL').length,
  };
  const passRate = summary.total > 0 ? (summary.pass / summary.total * 100).toFixed(1) : '0';

  return (
    <Card className="bg-card border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2 text-foreground">
            <Brain className="h-6 w-6 text-primary" />
            <span>RAG Quality Evaluation</span>
          </CardTitle>
          <Button 
            onClick={runEvaluation}
            disabled={evaluating}
            className="bg-primary hover:bg-primary/90"
          >
            {evaluating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Evaluating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Evaluation
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {results.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Evaluations Yet</h3>
            <p className="text-muted-foreground mb-6">
              Run an evaluation to test your RAG system's quality with Golden Questions.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-card border border-primary/30 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-primary">{passRate}%</div>
                <div className="text-sm text-muted-foreground">Pass Rate</div>
              </div>
              <div className="bg-card border border-green-500/30 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-500">{summary.pass}</div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="bg-card border border-yellow-500/30 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-500">{summary.partial}</div>
                <div className="text-sm text-muted-foreground">Partial</div>
              </div>
              <div className="bg-card border border-red-500/30 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-500">{summary.fail}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Quality Score</span>
                <span>{summary.pass + Math.floor(summary.partial / 2)} / {summary.total}</span>
              </div>
              <Progress 
                value={(summary.pass / summary.total) * 100} 
                className="h-3"
              />
            </div>

            {/* Results List */}
            <div className="space-y-3">
              {results.map((result) => (
                <Collapsible
                  key={result.id}
                  open={expandedId === result.id}
                  onOpenChange={() => setExpandedId(expandedId === result.id ? null : result.id)}
                >
                  <Card className={`border-l-4 ${result.score === 'PASS' ? 'border-l-green-500' : result.score === 'PARTIAL' ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
                    <CollapsibleTrigger className="w-full">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 mb-2">
                              {getScoreIcon(result.score)}
                              <Badge className={getScoreBadge(result.score)}>
                                {result.score}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {result.question.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {result.coverage} coverage
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-foreground">
                              {result.question.question}
                            </p>
                          </div>
                          {expandedId === result.id ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground ml-2" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground ml-2" />
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t border-border/50 mt-2">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">Answer:</div>
                          <p className="text-sm text-foreground">{result.answer}</p>
                        </div>
                        
                        {result.rationale && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground mb-1">Rationale:</div>
                            <p className="text-sm text-muted-foreground italic">{result.rationale}</p>
                          </div>
                        )}
                        
                        {result.missing_keywords?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground mb-1">Missing Keywords:</div>
                            <div className="flex flex-wrap gap-1">
                              {result.missing_keywords.map((kw, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.citations?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground mb-1">Citations:</div>
                            <div className="flex flex-wrap gap-1">
                              {result.citations.map((citation: any, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  Page {citation.page}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}