import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ManualSelector } from '@/components/ManualSelector';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FlaskConical, Zap, ArrowRight, Home } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface RAGResult {
  answer: string;
  chunks: Array<{
    content: string;
    score: number;
    page_start?: number;
    page_end?: number;
    content_type?: string;
  }>;
  strategy?: string;
  performance?: {
    search_time?: number;
    total_time?: number;
  };
  signals?: {
    top_score?: number;
    avg_top_3?: number;
    strong_hits?: number;
  };
}

const RAGTestingLab = () => {
  const [query, setQuery] = useState('');
  const [selectedManualId, setSelectedManualId] = useState<string | null>(null);
  const [selectedManualTitle, setSelectedManualTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [v3Result, setV3Result] = useState<RAGResult | null>(null);
  const [legacyResult, setLegacyResult] = useState<RAGResult | null>(null);

  const handleManualChange = (manualId: string | null, manualTitle: string | null) => {
    setSelectedManualId(manualId);
    setSelectedManualTitle(manualTitle);
  };

  const runTest = async () => {
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }

    if (!selectedManualId) {
      toast.error('Please select a game manual');
      return;
    }

    setLoading(true);
    setV3Result(null);
    setLegacyResult(null);

    try {
      // Run both pipelines in parallel
      const [v3Response, legacyResponse] = await Promise.all([
        supabase.functions.invoke('chat-manual', {
          body: {
            query: query.trim(),
            manual_id: selectedManualId,
            manual_title: selectedManualTitle,
            use_legacy_search: false,
          },
        }),
        supabase.functions.invoke('chat-manual', {
          body: {
            query: query.trim(),
            manual_id: selectedManualId,
            manual_title: selectedManualTitle,
            use_legacy_search: true,
          },
        }),
      ]);

      if (v3Response.error) throw new Error('V3 pipeline error: ' + v3Response.error.message);
      if (legacyResponse.error) throw new Error('Legacy pipeline error: ' + legacyResponse.error.message);

      // Extract results
      const v3Data = v3Response.data;
      const legacyData = legacyResponse.data;

      console.log('V3 Response:', v3Data);
      console.log('Legacy Response:', legacyData);

      // Build fallback chunks from sources if rag_debug is missing
      const buildFallbackChunks = (data: any) => {
        if (data.rag_debug?.retrieved_chunks?.length > 0) {
          return data.rag_debug.retrieved_chunks;
        }
        // Fallback to sources
        return (data.sources || []).slice(0, 10).map((s: any) => ({
          id: s.id || crypto.randomUUID(),
          content: s.content || '',
          score: s.score ?? 0,
          rerank_score: s.rerank_score ?? 0,
          page_start: s.page_start,
          page_end: s.page_end,
          content_type: s.content_type || 'text',
        }));
      };

      // Compute fallback signals if missing
      const computeFallbackSignals = (chunks: any[]) => {
        if (chunks.length === 0) {
          return { top_score: 0, avg_top_3: 0, strong_hits: 0 };
        }
        const topScore = chunks[0]?.rerank_score ?? chunks[0]?.score ?? 0;
        const avgTop3 = chunks.slice(0, 3).reduce((sum, c) => sum + (c.rerank_score ?? c.score ?? 0), 0) / Math.min(3, chunks.length);
        const strongHits = chunks.filter(c => (c.rerank_score ?? c.score ?? 0) > 0.62).length;
        return { top_score: topScore, avg_top_3: avgTop3, strong_hits: strongHits };
      };

      const v3Chunks = buildFallbackChunks(v3Data);
      const legacyChunks = buildFallbackChunks(legacyData);

      setV3Result({
        answer: v3Data.answer || 'No answer generated',
        chunks: v3Chunks,
        strategy: v3Data.rag_debug?.strategy || v3Data.strategy,
        performance: v3Data.rag_debug?.performance || { search_time: null, total_time: null },
        signals: v3Data.rag_debug?.signals || computeFallbackSignals(v3Chunks),
      });

      setLegacyResult({
        answer: legacyData.answer || 'No answer generated',
        chunks: legacyChunks,
        strategy: legacyData.rag_debug?.strategy || legacyData.strategy,
        performance: legacyData.rag_debug?.performance || { search_time: null, total_time: null },
        signals: legacyData.rag_debug?.signals || computeFallbackSignals(legacyChunks),
      });

      toast.success('Test completed successfully');
    } catch (error: any) {
      console.error('Test error:', error);
      toast.error(error.message || 'Failed to run test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">RAG Testing Lab</h1>
            <p className="text-muted-foreground">Compare V3 and Legacy search pipelines side-by-side</p>
          </div>
        </div>
        <Link to="/">
          <Button variant="outline" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
        </Link>
      </div>

      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>Set up your A/B test parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <ManualSelector
              selectedManualId={selectedManualId || undefined}
              onManualChange={handleManualChange}
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">Query</label>
            <Textarea
              placeholder="Enter your test query here..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <Button onClick={runTest} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Test...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Run A/B Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Grid */}
      {(v3Result || legacyResult) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* V3 Pipeline Results */}
          <Card className="border-blue-500/50 bg-blue-950/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <Zap className="h-5 w-5" />
                  V3 Pipeline
                </CardTitle>
                {v3Result?.strategy && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500">
                    {v3Result.strategy}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Answer */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Answer</h3>
                <Alert>
                  <AlertDescription className="text-sm whitespace-pre-wrap">
                    {v3Result?.answer}
                  </AlertDescription>
                </Alert>
              </div>

              {/* Signals */}
              {v3Result?.signals && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Signals</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-xs text-muted-foreground">Top Score</div>
                      <div className="font-bold">{v3Result.signals.top_score?.toFixed(3)}</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-xs text-muted-foreground">Avg Top 3</div>
                      <div className="font-bold">{v3Result.signals.avg_top_3?.toFixed(3)}</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-xs text-muted-foreground">Strong Hits</div>
                      <div className="font-bold">{v3Result.signals.strong_hits}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance - Always show */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Performance</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Search</div>
                    <div className="font-bold">
                      {v3Result?.performance?.search_time != null 
                        ? `${v3Result.performance.search_time.toFixed(0)}ms` 
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-bold">
                      {v3Result?.performance?.total_time != null 
                        ? `${v3Result.performance.total_time.toFixed(0)}ms` 
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Retrieved Chunks */}
              <div>
                <h3 className="font-semibold text-sm mb-2">
                  Retrieved Chunks ({v3Result?.chunks?.length || 0})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {v3Result?.chunks?.map((chunk, idx) => (
                    <div key={idx} className="p-3 bg-muted rounded text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          Score: {chunk.score?.toFixed(3)}
                        </Badge>
                        {chunk.page_start && (
                          <span className="text-muted-foreground">
                            Page {chunk.page_start}
                            {chunk.page_end && chunk.page_end !== chunk.page_start && `-${chunk.page_end}`}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-3">{chunk.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legacy Pipeline Results */}
          <Card className="border-orange-500/50 bg-orange-950/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-orange-400">
                  <ArrowRight className="h-5 w-5" />
                  Legacy Pipeline
                </CardTitle>
                {legacyResult?.strategy && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500">
                    {legacyResult.strategy}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Answer */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Answer</h3>
                <Alert>
                  <AlertDescription className="text-sm whitespace-pre-wrap">
                    {legacyResult?.answer}
                  </AlertDescription>
                </Alert>
              </div>

              {/* Signals */}
              {legacyResult?.signals && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Signals</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-xs text-muted-foreground">Top Score</div>
                      <div className="font-bold">{legacyResult.signals.top_score?.toFixed(3)}</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-xs text-muted-foreground">Avg Top 3</div>
                      <div className="font-bold">{legacyResult.signals.avg_top_3?.toFixed(3)}</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-xs text-muted-foreground">Strong Hits</div>
                      <div className="font-bold">{legacyResult.signals.strong_hits}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance - Always show */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Performance</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Search</div>
                    <div className="font-bold">
                      {legacyResult?.performance?.search_time != null 
                        ? `${legacyResult.performance.search_time.toFixed(0)}ms` 
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-bold">
                      {legacyResult?.performance?.total_time != null 
                        ? `${legacyResult.performance.total_time.toFixed(0)}ms` 
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Retrieved Chunks */}
              <div>
                <h3 className="font-semibold text-sm mb-2">
                  Retrieved Chunks ({legacyResult?.chunks?.length || 0})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {legacyResult?.chunks?.map((chunk, idx) => (
                    <div key={idx} className="p-3 bg-muted rounded text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          Score: {chunk.score?.toFixed(3)}
                        </Badge>
                        {chunk.page_start && (
                          <span className="text-muted-foreground">
                            Page {chunk.page_start}
                            {chunk.page_end && chunk.page_end !== chunk.page_start && `-${chunk.page_end}`}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-3">{chunk.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RAGTestingLab;
