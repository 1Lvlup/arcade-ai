import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Brain, Search, FileText } from 'lucide-react';

interface QualityMetrics {
  manual_id: string;
  timestamp: string;
  quality_metrics?: {
    scores: {
      overall: number;
      chunk_quality: {
        total_chunks: number;
        avg_length: number;
        short_chunks: number;
        long_chunks: number;
        uniqueness: number;
      };
      figure_quality?: {
        total_figures: number;
        enhanced_descriptions: number;
        enhancement_rate: number;
      };
      embedding_quality: {
        embedded_chunks: number;
        embedding_rate: number;
      };
    };
    issues: string[];
    recommendations: string[];
  };
  golden_questions?: Array<{
    question: string;
    expected_topics: string[];
  }>;
  search_quality?: {
    pass_rate: number;
    results: Array<{
      question: string;
      search_results?: number;
      avg_similarity?: number;
      status: string;
      error?: string;
    }>;
  };
}

interface QualityDashboardProps {
  manual_id: string;
  manual_title: string;
}

export function QualityDashboard({ manual_id, manual_title }: QualityDashboardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<QualityMetrics | null>(null);
  const [testType, setTestType] = useState<'all' | 'metrics' | 'questions' | 'search'>('all');
  const { toast } = useToast();

  const runQualityCheck = async (type: string = 'all') => {
    setIsLoading(true);
    setTestType(type as any);
    
    try {
      const { data, error } = await supabase.functions.invoke('quality-check', {
        body: { manual_id, test_type: type }
      });

      if (error) {
        throw new Error(error.message);
      }

      setResults(data);
      
      const overallScore = data.quality_metrics?.scores?.overall || 0;
      const scoreColor = overallScore >= 85 ? 'success' : overallScore >= 70 ? 'warning' : 'destructive';
      
      toast({
        title: "Quality Check Complete",
        description: `Overall score: ${overallScore}% for ${manual_title}`,
        variant: scoreColor === 'destructive' ? 'destructive' : 'default'
      });

    } catch (error) {
      console.error('Quality check error:', error);
      toast({
        title: "Quality Check Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 85) return 'default';
    if (score >= 70) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Quality Dashboard - {manual_title}
        </CardTitle>
        <CardDescription>
          Run comprehensive quality checks on your processed manual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => runQualityCheck('all')} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading && testType === 'all' && <Loader2 className="h-4 w-4 animate-spin" />}
            <CheckCircle className="h-4 w-4" />
            Full Quality Check
          </Button>
          <Button 
            variant="outline" 
            onClick={() => runQualityCheck('metrics')} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading && testType === 'metrics' && <Loader2 className="h-4 w-4 animate-spin" />}
            <FileText className="h-4 w-4" />
            Data Quality Only
          </Button>
          <Button 
            variant="outline" 
            onClick={() => runQualityCheck('questions')} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading && testType === 'questions' && <Loader2 className="h-4 w-4 animate-spin" />}
            <Brain className="h-4 w-4" />
            Generate Test Questions
          </Button>
          <Button 
            variant="outline" 
            onClick={() => runQualityCheck('search')} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading && testType === 'search' && <Loader2 className="h-4 w-4 animate-spin" />}
            <Search className="h-4 w-4" />
            Test Search Quality
          </Button>
        </div>

        {/* Results Display */}
        {results && (
          <div className="space-y-6">
            {/* Overall Score */}
            {results.quality_metrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Overall Quality Score</span>
                    <Badge variant={getScoreBadgeVariant(results.quality_metrics.scores.overall)}>
                      {results.quality_metrics.scores.overall}%
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress 
                    value={results.quality_metrics.scores.overall} 
                    className="w-full mb-4" 
                  />
                  
                  {/* Detailed Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Chunk Quality</h4>
                      <p className="text-sm text-muted-foreground">
                        {results.quality_metrics.scores.chunk_quality.total_chunks} chunks
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Avg length: {results.quality_metrics.scores.chunk_quality.avg_length} chars
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Uniqueness: {results.quality_metrics.scores.chunk_quality.uniqueness}%
                      </p>
                    </div>
                    
                    {results.quality_metrics.scores.figure_quality && (
                      <div className="space-y-2">
                        <h4 className="font-semibold">Figure Quality</h4>
                        <p className="text-sm text-muted-foreground">
                          {results.quality_metrics.scores.figure_quality.total_figures} figures
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Enhanced: {results.quality_metrics.scores.figure_quality.enhanced_descriptions}
                        </p>
                        <Badge variant={getScoreBadgeVariant(results.quality_metrics.scores.figure_quality.enhancement_rate)}>
                          {results.quality_metrics.scores.figure_quality.enhancement_rate}% enhanced
                        </Badge>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold">Embedding Quality</h4>
                      <p className="text-sm text-muted-foreground">
                        {results.quality_metrics.scores.embedding_quality.embedded_chunks} embedded
                      </p>
                      <Badge variant={getScoreBadgeVariant(results.quality_metrics.scores.embedding_quality.embedding_rate)}>
                        {results.quality_metrics.scores.embedding_quality.embedding_rate}% complete
                      </Badge>
                    </div>
                  </div>

                  {/* Issues and Recommendations */}
                  {results.quality_metrics.issues.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-red-600 flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        Issues Detected
                      </h4>
                      <ul className="space-y-1">
                        {results.quality_metrics.issues.map((issue, index) => (
                          <li key={index} className="text-sm text-red-600">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {results.quality_metrics.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-green-600 flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4" />
                        Recommendations
                      </h4>
                      <ul className="space-y-1">
                        {results.quality_metrics.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-green-600">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Search Quality Results */}
            {results.search_quality && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Search Quality Test</span>
                    <Badge variant={getScoreBadgeVariant(results.search_quality.pass_rate)}>
                      {results.search_quality.pass_rate}% pass rate
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.search_quality.results.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{result.question}</p>
                          {result.search_results !== undefined && (
                            <p className="text-xs text-muted-foreground">
                              {result.search_results} results, {result.avg_similarity} avg similarity
                            </p>
                          )}
                          {result.error && (
                            <p className="text-xs text-red-600">{result.error}</p>
                          )}
                        </div>
                        <div className="ml-4">
                          {result.status === 'pass' && <CheckCircle className="h-5 w-5 text-green-600" />}
                          {result.status === 'fail' && <XCircle className="h-5 w-5 text-red-600" />}
                          {result.status === 'error' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Golden Questions */}
            {results.golden_questions && (
              <Card>
                <CardHeader>
                  <CardTitle>Generated Test Questions</CardTitle>
                  <CardDescription>
                    High-quality questions to test manual coverage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.golden_questions.map((q, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <p className="text-sm font-medium">{q.question}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {q.expected_topics.map((topic, topicIndex) => (
                            <Badge key={topicIndex} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}