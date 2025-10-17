import { useState, useEffect } from 'react';
import { SharedHeader } from '@/components/SharedHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrainingAuth } from '@/hooks/useTrainingAuth';
import { useToast } from '@/hooks/use-toast';
import { TrainingLogin } from '@/components/TrainingLogin';

interface QueryLog {
  id: string;
  query_text: string;
  response_text: string;
  quality_tier: string;
  quality_score: number;
  numeric_flags: any;
  created_at: string;
  manual_id: string;
}

export default function TrainingInbox() {
  const navigate = useNavigate();
  const { isAuthenticated, adminKey } = useTrainingAuth();
  const { toast } = useToast();
  const [queries, setQueries] = useState<QueryLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (isAuthenticated && adminKey) {
      fetchInbox();
    }
  }, [isAuthenticated, adminKey, filter]);

  const fetchInbox = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter !== 'all') {
        params.append('tier', filter);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/training-inbox?${params}`,
        {
          headers: {
            'x-admin-key': adminKey!,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch inbox');
      }

      const data = await response.json();
      setQueries(data.items || []);
    } catch (error) {
      console.error('Error fetching inbox:', error);
      toast({
        title: 'Error',
        description: 'Failed to load inbox',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <TrainingLogin />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Training Inbox" showBackButton backTo="/training-hub" />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/training-hub')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Review Inbox</h1>
                <p className="text-muted-foreground">
                  {isLoading ? 'Loading...' : `${queries.length} queries pending review`}
                </p>
              </div>
            </div>
            
            <Button variant="outline" onClick={fetchInbox} disabled={isLoading}>
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <Tabs value={filter} onValueChange={setFilter} className="w-full">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="low">Low Quality</TabsTrigger>
              <TabsTrigger value="medium">Medium Quality</TabsTrigger>
              <TabsTrigger value="high">High Quality</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="space-y-4 mt-6">
              {isLoading ? (
                <Card className="p-6">
                  <div className="text-center text-muted-foreground">
                    <p>Loading queries...</p>
                  </div>
                </Card>
              ) : queries.length === 0 ? (
                <Card className="p-6">
                  <div className="text-center text-muted-foreground">
                    <p className="text-lg">No queries to review</p>
                    <p className="text-sm mt-2">Queries will appear here as they are logged</p>
                  </div>
                </Card>
              ) : (
                queries.map((query) => (
                  <Card key={query.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={
                              query.quality_tier === 'high' ? 'default' :
                              query.quality_tier === 'medium' ? 'secondary' : 'destructive'
                            }>
                              {query.quality_tier}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Score: {(query.quality_score || 0).toFixed(2)}
                            </span>
                            {query.numeric_flags && JSON.parse(query.numeric_flags).length > 0 && (
                              <Badge variant="outline" className="gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Numbers Detected
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-lg">{query.query_text}</h3>
                        </div>
                        <Button size="sm" onClick={() => navigate(`/training-hub/review/${query.id}`)}>
                          Review
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {query.response_text}
                      </p>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {new Date(query.created_at).toLocaleString()} • Manual: {query.manual_id || 'N/A'}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
