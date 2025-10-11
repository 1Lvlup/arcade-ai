import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Manual {
  manual_id: string;
  canonical_title: string;
  canonical_slug: string;
}

interface RetrievalHit {
  id: string;
  manual_id: string;
  content: string;
  score: number;
  page_start?: number;
  page_end?: number;
}

export const QuickTestConsole = () => {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [selectedManual, setSelectedManual] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RetrievalHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingManuals, setLoadingManuals] = useState(false);

  const loadManuals = async () => {
    setLoadingManuals(true);
    try {
      const { data, error } = await supabase.rpc('get_manuals_for_dropdown');
      if (error) throw error;
      setManuals(data || []);
    } catch (error: any) {
      toast.error('Failed to load manuals', {
        description: error.message
      });
    } finally {
      setLoadingManuals(false);
    }
  };

  const handleTest = async () => {
    if (!query.trim()) {
      toast.error('Please enter a test question');
      return;
    }

    setLoading(true);
    try {
      // Create embedding for query
      const { data: embeddingData, error: embError } = await supabase.functions.invoke('generate-embedding', {
        body: { text: query }
      });

      if (embError) throw embError;

      // Search using match_chunks_improved
      const { data, error } = await supabase.rpc('match_chunks_improved', {
        query_embedding: embeddingData.embedding,
        top_k: 5,
        min_score: 0.3,
        manual: selectedManual === 'all' ? null : selectedManual,
        tenant_id: null
      });

      if (error) throw error;

      setResults(data || []);
      
      if (!data || data.length === 0) {
        toast.info('No results found', {
          description: 'Try a different query or manual'
        });
      }
    } catch (error: any) {
      toast.error('Test failed', {
        description: error.message
      });
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>Quick Test Console</CardTitle>
        <CardDescription>Test retrieval quality for any manual</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select Manual (optional)</Label>
          <div className="flex gap-2">
            <Select value={selectedManual} onValueChange={setSelectedManual}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All Manuals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Manuals</SelectItem>
                {manuals.map(manual => (
                  <SelectItem key={manual.manual_id} value={manual.manual_id}>
                    {manual.canonical_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={loadManuals}
              disabled={loadingManuals}
            >
              {loadingManuals ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="query">Test Question</Label>
          <Textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="How do I reset the motor?"
            rows={3}
          />
        </div>

        <Button 
          onClick={handleTest} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Test Retrieval
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Top {results.length} Results</h3>
              <Badge variant="secondary">
                Avg Score: {(results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(3)}
              </Badge>
            </div>

            <div className="space-y-3">
              {results.map((hit, index) => (
                <Card key={hit.id} className="border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {hit.manual_id}
                          </code>
                          {hit.page_start && (
                            <span className="text-xs text-muted-foreground">
                              Page {hit.page_start}{hit.page_end !== hit.page_start ? `-${hit.page_end}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant={hit.score > 0.7 ? 'default' : hit.score > 0.5 ? 'secondary' : 'outline'}
                      >
                        {hit.score.toFixed(3)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {hit.content.substring(0, 200)}...
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};