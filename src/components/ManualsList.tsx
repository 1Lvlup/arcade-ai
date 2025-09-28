import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, Calendar, Search, Activity, Database, Eye, Trash2 } from 'lucide-react';
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

      // Fetch chunk counts for all manuals
      if (data && data.length > 0) {
        const { data: chunkData, error: chunkError } = await supabase
          .from('chunks_text')
          .select('manual_id')
          .in('manual_id', data.map(m => m.manual_id));

        if (!chunkError && chunkData) {
          const counts = data.map(manual => ({
            manual_id: manual.manual_id,
            count: chunkData.filter(chunk => chunk.manual_id === manual.manual_id).length
          }));
          setChunkCounts(counts);
        }
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
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-primary" />
          <span>Your Manuals</span>
        </CardTitle>
        <CardDescription>
          {manuals.length} manual{manuals.length !== 1 ? 's' : ''} available for troubleshooting
        </CardDescription>
      </CardHeader>
      <CardContent>
        {manuals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No manuals uploaded yet</p>
            <p className="text-sm">Upload your first manual to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {manuals.map((manual) => {
              const status = getProcessingStatus(manual);
              const StatusIcon = status.icon;
              return (
                <div
                  key={manual.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium truncate">{manual.title}</h3>
                      <Badge variant={status.variant} className="text-xs flex items-center space-x-1">
                        <StatusIcon className={`h-3 w-3 ${status.color} ${status.status === 'processing' ? 'animate-pulse' : ''}`} />
                        <span>{status.label}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span className="truncate">{manual.source_filename}</span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(manual.created_at)}</span>
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Manual ID: {manual.manual_id}
                      {manual.job_id && (
                        <span className="ml-2">
                          Job ID: {manual.job_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/manuals/${manual.manual_id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={status.status !== 'processed'}
                      title={status.status !== 'processed' ? 'Manual still processing' : 'Search this manual'}
                      onClick={() => {
                        if (status.status === 'processed') {
                          const searchParams = new URLSearchParams({
                            manual_id: manual.manual_id,
                            title: manual.title || manual.source_filename
                          });
                          window.open(`/?chat=true&${searchParams.toString()}`, '_blank');
                        }
                      }}
                    >
                      <Search className="h-4 w-4 mr-1" />
                      Search
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingManualId === manual.manual_id}
                          title="Delete manual"
                        >
                          {deletingManualId === manual.manual_id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-destructive" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}