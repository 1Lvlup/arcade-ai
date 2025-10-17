import { useState, useEffect } from 'react';
import { SharedHeader } from '@/components/SharedHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, AlertCircle, CheckCircle, XCircle, Flag } from 'lucide-react';
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
  const [manualFilter, setManualFilter] = useState('all');
  const [hasNumbersFilter, setHasNumbersFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manuals, setManuals] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthenticated && adminKey) {
      fetchInbox();
    }
  }, [isAuthenticated, adminKey, filter, manualFilter, hasNumbersFilter]);

  const fetchInbox = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filter !== 'all') {
        params.append('tier', filter);
      }
      if (manualFilter !== 'all') {
        params.append('manual_id', manualFilter);
      }
      if (hasNumbersFilter !== 'all') {
        params.append('has_numbers', hasNumbersFilter);
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
      
      // Extract unique manual IDs for filter
      const uniqueManuals = [...new Set(data.items.map((q: QueryLog) => q.manual_id).filter(Boolean))] as string[];
      setManuals(uniqueManuals);
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

  const handleBulkAction = async (action: 'accept' | 'reject' | 'flag') => {
    if (selectedIds.size === 0) {
      toast({
        title: 'No selection',
        description: 'Please select items first',
        variant: 'destructive',
      });
      return;
    }

    // Confirmation
    const actionText = action === 'accept' ? 'Accept' : action === 'reject' ? 'Reject' : 'Flag';
    if (!confirm(`${actionText} ${selectedIds.size} selected items?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/training-bulk-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey!,
          },
          body: JSON.stringify({
            query_ids: Array.from(selectedIds),
            action,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Bulk action failed');
      }

      const result = await response.json();

      toast({
        title: `Bulk ${actionText} Complete`,
        description: `Processed ${result.processed} items. ${result.succeeded} succeeded, ${result.failed} failed.`,
      });

      // Clear selection and refresh
      setSelectedIds(new Set());
      await fetchInbox();
    } catch (error) {
      console.error('Bulk action error:', error);
      toast({
        title: 'Error',
        description: `Failed to ${action} items`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === queries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queries.map(q => q.id)));
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
                  {isLoading ? 'Loading...' : `${queries.length} queries • ${selectedIds.size} selected`}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchInbox} disabled={isLoading}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters Row */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Manual:</label>
                <Select value={manualFilter} onValueChange={setManualFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All manuals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All manuals</SelectItem>
                    {manuals.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Numbers:</label>
                <Select value={hasNumbersFilter} onValueChange={setHasNumbersFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Has Numbers</SelectItem>
                    <SelectItem value="false">No Numbers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1" />

              {selectedIds.size > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleBulkAction('accept')}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Accept ({selectedIds.size})
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkAction('reject')}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject ({selectedIds.size})
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkAction('flag')}>
                    <Flag className="h-4 w-4 mr-1" />
                    Flag ({selectedIds.size})
                  </Button>
                </div>
              )}
            </div>
          </Card>

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
                <>
                  {queries.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={selectedIds.size === queries.length}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-sm text-muted-foreground">Select all</span>
                    </div>
                  )}
                  
                  {queries.map((query) => (
                    <Card key={query.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedIds.has(query.id)}
                            onCheckedChange={() => toggleSelection(query.id)}
                            className="mt-1"
                          />
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
                      <CardContent className="pl-12">
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {query.response_text}
                        </p>
                        <div className="mt-3 text-xs text-muted-foreground">
                          {new Date(query.created_at).toLocaleString()} • Manual: {query.manual_id || 'N/A'}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
