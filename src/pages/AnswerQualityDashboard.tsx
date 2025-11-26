import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Lightbulb,
  Award,
  BarChart3
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Evaluation {
  id: string;
  query_log_id: string;
  evaluation_timestamp: string;
  overall_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  accuracy_score: number;
  completeness_score: number;
  clarity_score: number;
  citation_quality_score: number;
  issues_found: string[];
  improvement_suggestions: string[];
  strengths: string[];
  query_logs: {
    query_text: string;
    response_text: string;
    manual_id: string;
  };
}

interface Stats {
  total: number;
  gradeDistribution: Record<string, number>;
  avgAccuracy: number;
  avgCompleteness: number;
  avgClarity: number;
  avgCitationQuality: number;
  commonIssues: Array<{ issue: string; count: number }>;
  topSuggestions: Array<{ suggestion: string; count: number }>;
}

const AnswerQualityDashboard = () => {
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<string>('all');

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('answer_evaluations')
        .select(`
          *,
          query_logs (
            query_text,
            response_text,
            manual_id
          )
        `)
        .order('evaluation_timestamp', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching evaluations:', error);
        toast({
          title: 'Error',
          description: 'Failed to load answer evaluations',
          variant: 'destructive',
        });
        return;
      }

      setEvaluations(data as unknown as Evaluation[] || []);
      calculateStats(data as unknown as Evaluation[] || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: 'Error',
        description: 'Failed to load evaluations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (evals: Evaluation[]) => {
    if (evals.length === 0) {
      setStats(null);
      return;
    }

    const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    let totalAccuracy = 0;
    let totalCompleteness = 0;
    let totalClarity = 0;
    let totalCitation = 0;
    const issueMap = new Map<string, number>();
    const suggestionMap = new Map<string, number>();

    evals.forEach(ev => {
      gradeDistribution[ev.overall_grade]++;
      totalAccuracy += ev.accuracy_score;
      totalCompleteness += ev.completeness_score;
      totalClarity += ev.clarity_score;
      totalCitation += ev.citation_quality_score;

      ev.issues_found.forEach(issue => {
        issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
      });

      ev.improvement_suggestions.forEach(sugg => {
        suggestionMap.set(sugg, (suggestionMap.get(sugg) || 0) + 1);
      });
    });

    const commonIssues = Array.from(issueMap.entries())
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topSuggestions = Array.from(suggestionMap.entries())
      .map(([suggestion, count]) => ({ suggestion, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setStats({
      total: evals.length,
      gradeDistribution,
      avgAccuracy: totalAccuracy / evals.length,
      avgCompleteness: totalCompleteness / evals.length,
      avgClarity: totalClarity / evals.length,
      avgCitationQuality: totalCitation / evals.length,
      commonIssues,
      topSuggestions,
    });
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-blue-500';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-orange-500';
      case 'F': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredEvaluations = selectedGrade === 'all'
    ? evaluations
    : evaluations.filter(ev => ev.overall_grade === selectedGrade);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading evaluations...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Answer Quality Dashboard</h2>
        <p className="text-muted-foreground">
          Automatic AI evaluation of answer quality with actionable insights
        </p>
      </div>

      {stats && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total Evaluations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.avgAccuracy.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">Avg Accuracy Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.avgCompleteness.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">Avg Completeness</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.avgClarity.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">Avg Clarity</p>
              </CardContent>
            </Card>
          </div>

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Grade Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {['A', 'B', 'C', 'D', 'F'].map(grade => (
                  <div key={grade} className="flex-1 text-center">
                    <div className={`h-24 ${getGradeColor(grade)} rounded-t-lg flex items-end justify-center pb-2 text-white font-bold`}>
                      {stats.gradeDistribution[grade]}
                    </div>
                    <div className="text-sm font-medium mt-1">{grade}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-6">
            {/* Common Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Most Common Issues
                </CardTitle>
                <CardDescription>Areas that need improvement</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {stats.commonIssues.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted">
                        <Badge variant="secondary">{item.count}</Badge>
                        <p className="text-sm flex-1">{item.issue}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Top Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Top Improvement Suggestions
                </CardTitle>
                <CardDescription>Recurring recommendations from evaluations</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {stats.topSuggestions.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted">
                        <Badge variant="secondary">{item.count}</Badge>
                        <p className="text-sm flex-1">{item.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Evaluation List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Evaluations</CardTitle>
          <CardDescription>Filter by grade to see specific evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedGrade} onValueChange={setSelectedGrade}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="A">A</TabsTrigger>
              <TabsTrigger value="B">B</TabsTrigger>
              <TabsTrigger value="C">C</TabsTrigger>
              <TabsTrigger value="D">D</TabsTrigger>
              <TabsTrigger value="F">F</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedGrade} className="mt-4">
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {filteredEvaluations.map((evaluation) => (
                    <Card key={evaluation.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-sm mb-1">
                              {evaluation.query_logs?.query_text || 'Unknown question'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(evaluation.evaluation_timestamp), 'MMM d, yyyy h:mm a')}
                            </div>
                          </div>
                          <Badge className={getGradeColor(evaluation.overall_grade)}>
                            {evaluation.overall_grade}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-2 mb-3">
                          <div className="text-center p-2 bg-muted rounded">
                            <div className="text-lg font-bold">{evaluation.accuracy_score}</div>
                            <div className="text-xs text-muted-foreground">Accuracy</div>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <div className="text-lg font-bold">{evaluation.completeness_score}</div>
                            <div className="text-xs text-muted-foreground">Complete</div>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <div className="text-lg font-bold">{evaluation.clarity_score}</div>
                            <div className="text-xs text-muted-foreground">Clarity</div>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <div className="text-lg font-bold">{evaluation.citation_quality_score}</div>
                            <div className="text-xs text-muted-foreground">Citations</div>
                          </div>
                        </div>

                        {evaluation.strengths.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center gap-1 text-xs font-medium text-green-600 mb-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Strengths
                            </div>
                            <ul className="text-xs space-y-1">
                              {evaluation.strengths.map((strength, idx) => (
                                <li key={idx} className="text-muted-foreground">• {strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {evaluation.issues_found.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center gap-1 text-xs font-medium text-orange-600 mb-1">
                              <AlertCircle className="h-3 w-3" />
                              Issues Found
                            </div>
                            <ul className="text-xs space-y-1">
                              {evaluation.issues_found.map((issue, idx) => (
                                <li key={idx} className="text-muted-foreground">• {issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {evaluation.improvement_suggestions.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1 text-xs font-medium text-blue-600 mb-1">
                              <Lightbulb className="h-3 w-3" />
                              Improvement Suggestions
                            </div>
                            <ul className="text-xs space-y-1">
                              {evaluation.improvement_suggestions.map((suggestion, idx) => (
                                <li key={idx} className="text-muted-foreground">• {suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {filteredEvaluations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No evaluations found for this grade
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnswerQualityDashboard;
