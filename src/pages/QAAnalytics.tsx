import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SharedHeader } from '@/components/SharedHeader';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2,
  Search,
  Calendar,
  BarChart3,
  Eye
} from 'lucide-react';

interface QueryLog {
  id: string;
  query_text: string;
  response_text: string;
  quality_tier: string;
  quality_score: number;
  claim_coverage: number;
  numeric_flags: any;
  created_at: string;
  manual_id: string;
  model_name: string;
  retrieval_method: string;
}

interface AnalyticsSummary {
  total_queries: number;
  avg_quality_score: number;
  high_quality_count: number;
  medium_quality_count: number;
  low_quality_count: number;
  avg_claim_coverage: number;
  queries_with_numbers: number;
  queries_last_24h: number;
  queries_last_7d: number;
}

export default function QAAnalytics() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queries, setQueries] = useState<QueryLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    fetchAnalytics();
  }, [tierFilter, dateFilter]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Build query with filters
      let query = supabase
        .from('query_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply tier filter
      if (tierFilter !== 'all') {
        query = query.eq('quality_tier', tierFilter);
      }

      // Apply date filter
      if (dateFilter === '24h') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        query = query.gte('created_at', yesterday.toISOString());
      } else if (dateFilter === '7d') {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        query = query.gte('created_at', lastWeek.toISOString());
      } else if (dateFilter === '30d') {
        const lastMonth = new Date();
        lastMonth.setDate(lastMonth.getDate() - 30);
        query = query.gte('created_at', lastMonth.toISOString());
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;

      setQueries(data || []);
      calculateSummary(data || []);
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSummary = (data: QueryLog[]) => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const summary: AnalyticsSummary = {
      total_queries: data.length,
      avg_quality_score: data.reduce((sum, q) => sum + (q.quality_score || 0), 0) / (data.length || 1),
      high_quality_count: data.filter(q => q.quality_tier === 'high').length,
      medium_quality_count: data.filter(q => q.quality_tier === 'medium').length,
      low_quality_count: data.filter(q => q.quality_tier === 'low').length,
      avg_claim_coverage: data.reduce((sum, q) => sum + (q.claim_coverage || 0), 0) / (data.length || 1),
      queries_with_numbers: data.filter(q => q.numeric_flags && Array.isArray(q.numeric_flags) && q.numeric_flags.length > 0).length,
      queries_last_24h: data.filter(q => new Date(q.created_at) > yesterday).length,
      queries_last_7d: data.filter(q => new Date(q.created_at) > lastWeek).length,
    };

    setSummary(summary);
  };

  const filteredQueries = queries.filter(q => 
    !searchTerm || 
    q.query_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.response_text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getQualityBadge = (tier: string) => {
    const variants: Record<string, { color: string; icon: any }> = {
      high: { color: 'bg-green-500/20 text-green-500 border-green-500/30', icon: CheckCircle2 },
      medium: { color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', icon: AlertCircle },
      low: { color: 'bg-red-500/20 text-red-500 border-red-500/30', icon: AlertCircle },
    };
    
    const variant = variants[tier] || variants.medium;
    const Icon = variant.icon;
    
    return (
      <Badge variant="outline" className={variant.color}>
        <Icon className="h-3 w-3 mr-1" />
        {tier}
      </Badge>
    );
  };

  const getGradeInterpretation = () => {
    if (!summary) return null;

    const highPercent = (summary.high_quality_count / summary.total_queries) * 100;
    const mediumPercent = (summary.medium_quality_count / summary.total_queries) * 100;
    const lowPercent = (summary.low_quality_count / summary.total_queries) * 100;

    const good: string[] = [];
    const bad: string[] = [];
    const important: string[] = [];

    // Good indicators
    if (highPercent > 60) {
      good.push(`Strong performance: ${highPercent.toFixed(1)}% high-quality responses`);
    }
    if (summary.avg_claim_coverage > 0.7) {
      good.push(`Excellent claim coverage: ${(summary.avg_claim_coverage * 100).toFixed(1)}%`);
    }
    if (summary.queries_with_numbers < summary.total_queries * 0.3) {
      good.push('Low number flag rate - responses are well-grounded');
    }

    // Bad indicators
    if (lowPercent > 30) {
      bad.push(`High failure rate: ${lowPercent.toFixed(1)}% low-quality responses need review`);
    }
    if (summary.avg_claim_coverage < 0.5) {
      bad.push(`Poor claim coverage: Only ${(summary.avg_claim_coverage * 100).toFixed(1)}% of claims supported`);
    }
    if (summary.avg_quality_score < 0.4) {
      bad.push(`Low average quality score: ${summary.avg_quality_score.toFixed(2)}/1.0`);
    }

    // Important findings
    if (summary.queries_with_numbers > summary.total_queries * 0.4) {
      important.push(`${summary.queries_with_numbers} responses contain numbers - verify accuracy`);
    }
    if (mediumPercent > 50) {
      important.push(`${mediumPercent.toFixed(1)}% medium-quality responses could be improved`);
    }
    important.push(`Activity: ${summary.queries_last_24h} queries in last 24h, ${summary.queries_last_7d} in last week`);

    return { good, bad, important };
  };

  const interpretation = getGradeInterpretation();

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Q&A Analytics" />
      
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Q&A Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive analysis of all AI responses with quality grades
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total_queries}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.queries_last_24h} in last 24h
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Quality Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.avg_quality_score.toFixed(2)}</div>
                <div className="flex items-center gap-2 mt-1">
                  {summary.avg_quality_score > 0.6 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {(summary.avg_claim_coverage * 100).toFixed(1)}% claim coverage
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Quality Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-500">High:</span>
                    <span className="font-bold">{summary.high_quality_count} ({((summary.high_quality_count / summary.total_queries) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-500">Medium:</span>
                    <span className="font-bold">{summary.medium_quality_count} ({((summary.medium_quality_count / summary.total_queries) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-500">Low:</span>
                    <span className="font-bold">{summary.low_quality_count} ({((summary.low_quality_count / summary.total_queries) * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Flagged Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.queries_with_numbers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Responses with numbers needing verification
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Overall Assessment */}
        {interpretation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Overall Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {interpretation.good.length > 0 && (
                <div>
                  <h3 className="font-semibold text-green-500 mb-2">✓ Good Performance</h3>
                  <ul className="space-y-1">
                    {interpretation.good.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {interpretation.bad.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-500 mb-2">✗ Areas for Improvement</h3>
                  <ul className="space-y-1">
                    {interpretation.bad.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {interpretation.important.length > 0 && (
                <div>
                  <h3 className="font-semibold text-primary mb-2">ℹ Important Notes</h3>
                  <ul className="space-y-1">
                    {interpretation.important.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Query Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search queries or responses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Quality tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quality</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={fetchAnalytics} variant="outline">
                Refresh
              </Button>
            </div>

            {/* Query List */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredQueries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No queries found</div>
              ) : (
                filteredQueries.map((query) => (
                  <Card key={query.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium mb-1">{query.query_text}</div>
                            <div className="text-sm text-muted-foreground line-clamp-2">
                              {query.response_text}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getQualityBadge(query.quality_tier)}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/training-inbox/${query.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Score: {(query.quality_score || 0).toFixed(2)}</span>
                          <span>Coverage: {((query.claim_coverage || 0) * 100).toFixed(0)}%</span>
                          {query.numeric_flags && Array.isArray(query.numeric_flags) && query.numeric_flags.length > 0 && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                              {query.numeric_flags.length} numbers
                            </Badge>
                          )}
                          <span className="ml-auto">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(query.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
