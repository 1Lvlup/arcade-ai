import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, Calendar, Search, Activity, Database, Eye, Trash2, RefreshCw } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Manual {
  id: string;
  manual_id: string;
  title: string;
  source_filename: string;
  created_at: string;
  updated_at: string;
  job_id?: string;
}

interface ChunkCount {
  manual_id: string;
  count: number;
}

export function ManualsList() {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [chunkCounts, setChunkCounts] = useState<ChunkCount[]>([]);
  const [deletingManualId, setDeletingManualId] = useState<string | null>(null);
  const [retryingManualId, setRetryingManualId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchManuals();
    
    // Set up realtime subscription for document updates
    const channel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        (payload) => {
          console.log('Document update:', payload);
          fetchManuals(); // Refresh list when documents change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchManuals = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setManuals(data || []);

      // Fetch chunk counts for all manuals using proper count queries
      if (data && data.length > 0) {
        const countPromises = data.map(async (manual) => {
          const { count, error } = await supabase
            .from('chunks_text')
            .select('*', { count: 'exact', head: true })
            .eq('manual_id', manual.manual_id);
          
          return {
            manual_id: manual.manual_id,
            count: error ? 0 : (count || 0)
          };
        });

        const counts = await Promise.all(countPromises);
        setChunkCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching manuals:', error);
      toast({
        title: 'Error loading manuals',
        description: 'Failed to load manual list',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const retryProcessing = async (manual: Manual) => {
    if (!manual.job_id) {
      toast({
        title: 'Cannot retry',
        description: 'No job ID found for this manual',
        variant: 'destructive',
      });
      return;
    }

    setRetryingManualId(manual.manual_id);
    
    try {
      const { data, error } = await supabase.functions.invoke('retry-stalled-job', {
        body: { 
          job_id: manual.job_id,
          manual_id: manual.manual_id 
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: 'Processing resumed',
          description: 'Manual processing has been restarted successfully',
        });
        // Refresh the manual list to get updated status
        fetchManuals();
      } else {
        toast({
          title: 'Retry failed',
          description: data?.message || 'Could not retry the stalled job',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error retrying manual processing:', error);
      toast({
        title: 'Error retrying processing',
        description: 'Failed to retry manual processing. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRetryingManualId(null);
    }
  };

  const deleteManual = async (manualId: string) => {
    setDeletingManualId(manualId);
    
    try {
      const { data, error } = await supabase.functions.invoke('delete-manual', {
        body: { manual_id: manualId }
      });

      if (error) {
        throw error;
      }

      // Remove from local state
      setManuals(prev => prev.filter(m => m.manual_id !== manualId));
      setChunkCounts(prev => prev.filter(c => c.manual_id !== manualId));
      
      toast({
        title: 'Manual deleted',
        description: 'Manual and all associated data have been removed',
      });
    } catch (error) {
      console.error('Error deleting manual:', error);
      toast({
        title: 'Error deleting manual',
        description: 'Failed to delete manual. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingManualId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProcessingStatus = (manual: Manual) => {
    const chunkCount = chunkCounts.find(c => c.manual_id === manual.manual_id)?.count || 0;
    const createdAt = new Date(manual.created_at);
    const now = new Date();
    const timeSinceCreation = now.getTime() - createdAt.getTime();
    
    if (chunkCount > 0) {
      return { 
        status: 'processed', 
        label: `Ready (${chunkCount} chunks)`, 
        variant: 'default' as const,
        icon: Database,
        color: 'text-green-500'
      };
    } else if (timeSinceCreation > 1800000) { // 30 minutes
      return { 
        status: 'stalled', 
        label: 'Processing stalled', 
        variant: 'destructive' as const,
        icon: Activity,
        color: 'text-red-500'
      };
    } else {
      return { 
        status: 'processing', 
        label: 'Processing...', 
        variant: 'secondary' as const,
        icon: Activity,
        color: 'text-orange-500'
      };
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Your Manuals</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3 text-muted-foreground">Loading manuals...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Your Manuals</span>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {manuals.length} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[600px] overflow-y-auto">
        {manuals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No manuals uploaded yet</p>
            <p className="text-sm">Upload your first manual to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {manuals.map((manual) => {
              const status = getProcessingStatus(manual);
              const StatusIcon = status.icon;
              return (
                <div
                  key={manual.id}
                  className="group p-4 border border-border rounded-lg hover:border-primary/40 hover:bg-accent/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{manual.title}</h3>
                        <Badge variant={status.variant} className="text-xs shrink-0 flex items-center gap-1">
                          <StatusIcon className={`h-3 w-3 ${status.color} ${status.status === 'processing' ? 'animate-pulse' : ''}`} />
                          <span>{status.label}</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{manual.source_filename}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(manual.created_at)}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/manuals/${manual.manual_id}`)}
                        className="h-8 px-3"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Details
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={status.status !== 'processed'}
                        onClick={() => {
                          if (status.status === 'processed') {
                            const searchParams = new URLSearchParams({
                              manual_id: manual.manual_id,
                              title: manual.title || manual.source_filename
                            });
                            window.open(`/?chat=true&${searchParams.toString()}`, '_blank');
                          }
                        }}
                        className="h-8 px-3"
                      >
                        <Search className="h-3.5 w-3.5 mr-1.5" />
                        Search
                      </Button>
                      
                      {status.status === 'stalled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={retryingManualId === manual.manual_id}
                          onClick={() => retryProcessing(manual)}
                          className="h-8 px-3"
                        >
                          {retryingManualId === manual.manual_id ? (
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary mr-1.5" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Retry
                        </Button>
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deletingManualId === manual.manual_id}
                            className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            {deletingManualId === manual.manual_id ? (
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-destructive" />
                            ) : (
                              <>
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                Delete
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Manual</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{manual.title || manual.source_filename}"? 
                              This will permanently remove the manual and all associated data including chunks and figures. 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteManual(manual.manual_id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Manual
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}