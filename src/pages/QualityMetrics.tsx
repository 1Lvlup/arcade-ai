import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SharedHeader } from "@/components/SharedHeader";
import { BarChart, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QualityMetrics {
  total_queries: number;
  graded_queries: number;
  avg_quality_score: number;
  quality_tier: string | null;
  count_per_tier: number;
}

interface DetailedQuery {
  id: string;
  created_at: string;
  query_text: string;
  quality_score: number;
  quality_tier: string;
  claim_coverage: number;
  vector_mean: number;
  rerank_mean: number;
  manual_id: string;
  model_name: string;
}

export default function QualityMetrics() {
  const [metrics, setMetrics] = useState<QualityMetrics[]>([]);
  const [detailedQueries, setDetailedQueries] = useState<DetailedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7");
  const { toast } = useToast();

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // Load tier distribution
      const { data: tierData, error: tierError } = await supabase
        .from("query_logs")
        .select("quality_score, quality_tier")
        .gte("created_at", new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString());

      if (tierError) throw tierError;

      // Calculate metrics
      const total = tierData.length;
      const graded = tierData.filter(q => q.quality_score !== null).length;
      
      // Group by tier
      const tierGroups: Record<string, QualityMetrics> = {};
      tierData.forEach(q => {
        const tier = q.quality_tier || "ungraded";
        if (!tierGroups[tier]) {
          tierGroups[tier] = {
            total_queries: 0,
            graded_queries: 0,
            avg_quality_score: 0,
            quality_tier: tier === "ungraded" ? null : tier,
            count_per_tier: 0,
          };
        }
        tierGroups[tier].total_queries++;
        tierGroups[tier].count_per_tier++;
        if (q.quality_score !== null) {
          tierGroups[tier].graded_queries++;
          tierGroups[tier].avg_quality_score += q.quality_score;
        }
      });

      // Calculate averages
      Object.values(tierGroups).forEach(group => {
        if (group.graded_queries > 0) {
          group.avg_quality_score = group.avg_quality_score / group.graded_queries;
        }
      });

      setMetrics(Object.values(tierGroups));

      // Load detailed queries
      const { data: detailData, error: detailError } = await supabase
        .from("query_logs")
        .select("id, created_at, query_text, quality_score, quality_tier, claim_coverage, vector_mean, rerank_mean, manual_id, model_name")
        .gte("created_at", new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString())
        .not("quality_score", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (detailError) throw detailError;
      setDetailedQueries(detailData || []);

    } catch (error: any) {
      toast({
        title: "Error loading metrics",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const totalQueries = metrics.reduce((sum, m) => sum + m.total_queries, 0);
  const totalGraded = metrics.reduce((sum, m) => sum + m.graded_queries, 0);
  const gradingPercentage = totalQueries > 0 ? (totalGraded / totalQueries * 100).toFixed(1) : "0";

  const getTierColor = (tier: string | null) => {
    if (!tier) return "bg-muted text-muted-foreground";
    switch (tier) {
      case "high": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "low": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
              <BarChart className="h-8 w-8 text-primary" />
              Quality Metrics Dashboard
            </h1>
            <p className="text-muted-foreground">
              Automated quality grading for all AI responses
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={loadMetrics} disabled={loading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalQueries}</div>
              <p className="text-xs text-muted-foreground mt-1">All responses tracked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Graded Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalGraded}</div>
              <p className="text-xs text-muted-foreground mt-1">{gradingPercentage}% graded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Quality Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {totalGraded > 0 
                  ? (metrics.reduce((sum, m) => sum + (m.avg_quality_score * m.graded_queries), 0) / totalGraded).toFixed(3)
                  : "N/A"
                }
              </div>
              <p className="text-xs text-muted-foreground mt-1">Composite metric</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Quality</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">
                {metrics.find(m => m.quality_tier === "high")?.count_per_tier || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Top tier responses</p>
            </CardContent>
          </Card>
        </div>

        {/* Grading Coverage Alert */}
        {totalQueries > 0 && parseFloat(gradingPercentage) < 100 && (
          <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-400 mb-1">Incomplete Grading Coverage</h3>
                  <p className="text-sm text-muted-foreground">
                    Only {gradingPercentage}% of queries have quality scores. Grading happens automatically after each response is generated.
                    Missing scores may indicate errors during the grading process or older queries before grading was implemented.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tier Distribution */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quality Tier Distribution</CardTitle>
            <CardDescription>Breakdown of response quality across all graded queries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics
                .filter(m => m.quality_tier !== null)
                .sort((a, b) => {
                  const order = { high: 0, medium: 1, low: 2 };
                  return order[a.quality_tier as keyof typeof order] - order[b.quality_tier as keyof typeof order];
                })
                .map((metric) => (
                  <div key={metric.quality_tier} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={getTierColor(metric.quality_tier)}>
                          {metric.quality_tier?.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {metric.count_per_tier} queries
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        Avg Score: {metric.avg_quality_score.toFixed(3)}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          metric.quality_tier === "high" ? "bg-green-500" :
                          metric.quality_tier === "medium" ? "bg-yellow-500" :
                          "bg-red-500"
                        }`}
                        style={{ width: `${totalGraded > 0 ? (metric.count_per_tier / totalGraded * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Graded Queries */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Graded Queries</CardTitle>
            <CardDescription>Latest {detailedQueries.length} queries with quality scores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {detailedQueries.map((query) => (
                <div key={query.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{query.query_text}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(query.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span>{query.manual_id || "No manual"}</span>
                        <span>•</span>
                        <span>{query.model_name}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={getTierColor(query.quality_tier)}>
                      {query.quality_tier?.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Quality Score:</span>
                      <span className="ml-2 font-medium">{query.quality_score?.toFixed(3) || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Claim Coverage:</span>
                      <span className="ml-2 font-medium">{query.claim_coverage ? (query.claim_coverage * 100).toFixed(0) + "%" : "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vector Mean:</span>
                      <span className="ml-2 font-medium">{query.vector_mean?.toFixed(3) || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rerank Mean:</span>
                      <span className="ml-2 font-medium">{query.rerank_mean?.toFixed(3) || "N/A"}</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {detailedQueries.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  No graded queries found in this time range
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
