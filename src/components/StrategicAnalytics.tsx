import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  MessageSquare,
  Target
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface QueryMetric {
  date: string;
  count: number;
}

interface ManualPopularity {
  manual_id: string;
  query_count: number;
  canonical_title?: string | null;
}

interface QualityTrend {
  date: string;
  avg_quality: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

export function StrategicAnalytics() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [queryMetrics, setQueryMetrics] = useState<QueryMetric[]>([]);
  const [manualPopularity, setManualPopularity] = useState<ManualPopularity[]>([]);
  const [qualityTrends, setQualityTrends] = useState<QualityTrend[]>([]);
  const [summary, setSummary] = useState({
    totalQueries: 0,
    avgQuality: 0,
    topManual: '',
    queryGrowth: 0,
    avgResponseTime: 0
  });

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = subDays(new Date(), daysAgo);

      // Fetch query logs
      const { data: queryLogs, error: logsError } = await supabase
        .from('query_logs')
        .select('created_at, quality_score, quality_tier, manual_id')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;

      // Calculate metrics by date
      const metricsByDate = new Map<string, number>();
      const qualityByDate = new Map<string, { scores: number[], high: number, medium: number, low: number }>();
      const manualCounts = new Map<string, number>();

      queryLogs?.forEach(log => {
        const date = format(new Date(log.created_at), 'yyyy-MM-dd');
        
        // Query counts
        metricsByDate.set(date, (metricsByDate.get(date) || 0) + 1);
        
        // Quality trends
        if (!qualityByDate.has(date)) {
          qualityByDate.set(date, { scores: [], high: 0, medium: 0, low: 0 });
        }
        const qual = qualityByDate.get(date)!;
        if (log.quality_score) qual.scores.push(log.quality_score);
        if (log.quality_tier === 'high') qual.high++;
        if (log.quality_tier === 'medium') qual.medium++;
        if (log.quality_tier === 'low') qual.low++;
        
        // Manual popularity
        if (log.manual_id) {
          manualCounts.set(log.manual_id, (manualCounts.get(log.manual_id) || 0) + 1);
        }
      });

      // Convert to arrays
      const metrics = Array.from(metricsByDate.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const quality = Array.from(qualityByDate.entries())
        .map(([date, data]) => ({
          date,
          avg_quality: data.scores.reduce((a, b) => a + b, 0) / (data.scores.length || 1),
          high_count: data.high,
          medium_count: data.medium,
          low_count: data.low
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const popularity = Array.from(manualCounts.entries())
        .map(([manual_id, query_count]) => ({ manual_id, query_count }))
        .sort((a, b) => b.query_count - a.query_count)
        .slice(0, 10);

      // Fetch manual titles
      if (popularity.length > 0) {
        const { data: manualData } = await supabase
          .from('manual_metadata')
          .select('manual_id, canonical_title')
          .in('manual_id', popularity.map(p => p.manual_id));

        const titleMap = new Map(manualData?.map(m => [m.manual_id, m.canonical_title]) || []);
        popularity.forEach(p => {
          const title = titleMap.get(p.manual_id);
          (p as ManualPopularity).canonical_title = title || null;
        });
      }

      setQueryMetrics(metrics);
      setQualityTrends(quality);
      setManualPopularity(popularity);

      // Calculate summary
      const totalQueries = queryLogs?.length || 0;
      const avgQuality = quality.reduce((sum, q) => sum + q.avg_quality, 0) / (quality.length || 1);
      const topManual = (popularity[0] as ManualPopularity)?.canonical_title || 'N/A';
      
      // Calculate growth (compare first half vs second half of period)
      const midpoint = Math.floor(metrics.length / 2);
      const firstHalf = metrics.slice(0, midpoint).reduce((sum, m) => sum + m.count, 0);
      const secondHalf = metrics.slice(midpoint).reduce((sum, m) => sum + m.count, 0);
      const growth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

      setSummary({
        totalQueries,
        avgQuality,
        topManual,
        queryGrowth: growth,
        avgResponseTime: 0 // Placeholder
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Strategic Analytics</h2>
          <p className="text-muted-foreground">Performance metrics and trends</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Total Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalQueries}</div>
            <div className="flex items-center gap-2 mt-1">
              {summary.queryGrowth >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-xs text-muted-foreground">
                {summary.queryGrowth.toFixed(1)}% vs previous period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Avg Quality Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgQuality.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of 1.0
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Top Manual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{summary.topManual}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Most queried manual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeRange}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {queryMetrics.length} data points
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Popularity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Top Manuals by Query Volume
          </CardTitle>
          <CardDescription>Most frequently queried manuals in selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {manualPopularity.map((manual, index) => (
              <div key={manual.manual_id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {manual.canonical_title || manual.manual_id}
                    </p>
                    <p className="text-xs text-muted-foreground">Manual ID: {manual.manual_id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{manual.query_count}</div>
                  <p className="text-xs text-muted-foreground">queries</p>
                </div>
              </div>
            ))}
            {manualPopularity.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No data available for selected period
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quality Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Distribution Trends</CardTitle>
          <CardDescription>Daily breakdown of response quality over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {qualityTrends.slice(-7).map((trend) => (
              <div key={trend.date} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {format(new Date(trend.date), 'MMM d, yyyy')}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Avg: {trend.avg_quality.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>High: {trend.high_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span>Medium: {trend.medium_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Low: {trend.low_count}</span>
                  </div>
                </div>
              </div>
            ))}
            {qualityTrends.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No quality data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
