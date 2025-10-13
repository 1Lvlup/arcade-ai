import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Eye,
  Activity,
  Zap,
  Database
} from 'lucide-react';

interface ProcessingStatus {
  job_id: string;
  manual_id: string;
  status: string;
  stage?: string;
  progress_percent: number;
  chunks_processed: number;
  total_chunks: number;
  figures_processed: number;
  total_figures: number;
  current_task?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

interface JobStatus {
  job_id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  created_at: string;
  updated_at: string;
  metadata?: any;
  chunks_created: boolean;
  progress: number;
}

interface ProcessingMonitorProps {
  job_id?: string;
  manual_id?: string;
  onComplete?: () => void;
}

export function ProcessingMonitor({ job_id, manual_id, onComplete }: ProcessingMonitorProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  const retryProcessing = async () => {
    if (!job_id) return;
    
    setLoading(true);
    try {
      toast({
        title: 'Retrying processing...',
        description: 'Manually triggering webhook for stalled job',
      });

      // Call a retry function that re-fetches from LlamaCloud and processes
      const { error } = await supabase.functions.invoke('retry-stalled-job', {
        body: { job_id, manual_id }
      });

      if (error) throw error;

      toast({
        title: 'Retry initiated',
        description: 'Processing should resume shortly',
      });

      // Refresh status after retry
      setTimeout(() => checkJobStatus(), 2000);

    } catch (error: any) {
      console.error('Error retrying job:', error);
      toast({
        title: 'Retry failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkJobStatus = async () => {
    if (!job_id) return;
    
    setLoading(true);
    try {
      // Check processing status first for real-time updates
      const { data: statusData, error: statusError } = await supabase
        .from('processing_status')
        .select('*')
        .eq('job_id', job_id)
        .single();

      if (!statusError && statusData) {
        setProcessingStatus(statusData);
      }

      // Also check job status for fallback
      const { data, error } = await supabase.functions.invoke('check-job-status', {
        body: { job_id }
      });

      if (error) throw error;

      setJobStatus(data);
      setLastChecked(new Date());

      // If job is complete and chunks are created, notify parent
      if ((data.status === 'SUCCESS' || statusData?.status === 'completed') && 
          (data.chunks_created || statusData?.chunks_processed > 0) && onComplete) {
        onComplete();
        setAutoRefresh(false);
      }

      // Detect stalled jobs (SUCCESS but no chunks after 2+ hours)
      if (data.status === 'SUCCESS' && !data.chunks_created && jobStatus) {
        const jobAge = Date.now() - new Date(jobStatus.created_at).getTime();
        if (jobAge > 2 * 60 * 60 * 1000) { // 2 hours
          console.warn('Detected stalled job:', job_id);
        }
      }

    } catch (error) {
      console.error('Error checking job status:', error);
      toast({
        title: 'Status check failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 5 seconds while processing for real-time feel
  useEffect(() => {
    if (!job_id || !autoRefresh) return;

    const interval = setInterval(() => {
      if (jobStatus?.status === 'PENDING' || jobStatus?.status === 'PROCESSING' || 
          processingStatus?.status === 'starting' || processingStatus?.status === 'processing') {
        checkJobStatus();
      } else if ((jobStatus?.status === 'SUCCESS' && jobStatus?.chunks_created) ||
                 (processingStatus?.status === 'completed')) {
        setAutoRefresh(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [job_id, autoRefresh, jobStatus?.status, processingStatus?.status]);

  // Set up real-time subscription for processing status
  useEffect(() => {
    if (!job_id) return;

    const channel = supabase
      .channel('processing-status-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processing_status',
          filter: `job_id=eq.${job_id}`
        },
        (payload) => {
          console.log('Real-time processing update:', payload);
          if (payload.new) {
            setProcessingStatus(payload.new as ProcessingStatus);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job_id]);

  // Initial check
  useEffect(() => {
    if (job_id) {
      checkJobStatus();
    }
  }, [job_id]);

  if (!job_id) return null;

  const getStatusDisplay = () => {
    if (!jobStatus) return { icon: Clock, label: 'Checking...', variant: 'secondary' as const, color: 'text-muted-foreground' };
    
    switch (jobStatus.status) {
      case 'PENDING':
        return { icon: Clock, label: 'Queued', variant: 'secondary' as const, color: 'text-blue-500' };
      case 'PROCESSING':
        return { icon: Activity, label: 'Processing', variant: 'default' as const, color: 'text-orange-500' };
      case 'SUCCESS':
        return jobStatus.chunks_created 
          ? { icon: CheckCircle, label: 'Completed', variant: 'default' as const, color: 'text-green-500' }
          : { icon: Database, label: 'Finalizing', variant: 'secondary' as const, color: 'text-blue-500' };
      case 'ERROR':
        return { icon: AlertCircle, label: 'Failed', variant: 'destructive' as const, color: 'text-red-500' };
      default:
        return { icon: Clock, label: 'Unknown', variant: 'secondary' as const, color: 'text-muted-foreground' };
    }
  };

  const status = getStatusDisplay();
  const StatusIcon = status.icon;

  const getEstimatedTime = () => {
    if (processingStatus) {
      if (processingStatus.status === 'completed') {
        return `Completed! ${processingStatus.chunks_processed} chunks and ${processingStatus.figures_processed} figures processed.`;
      }
      if (processingStatus.status === 'failed') {
        return processingStatus.error_message || 'Processing failed - please try again';
      }
      if (processingStatus.current_task) {
        return processingStatus.current_task;
      }
    }
    
    if (!jobStatus) return 'Checking status...';
    
    switch (jobStatus.status) {
      case 'PENDING':
        return 'Usually starts within 1-2 minutes';
      case 'PROCESSING':
        return 'Large PDFs typically take 5-15 minutes';
      case 'SUCCESS':
        return jobStatus.chunks_created ? 'Processing complete!' : 'Saving to database...';
      case 'ERROR':
        return 'Processing failed - check logs';
      default:
        return 'Status unknown';
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <StatusIcon className={`h-5 w-5 ${status.color} ${jobStatus?.status === 'PROCESSING' ? 'animate-pulse' : ''}`} />
            <span>Processing Status</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={status.variant} className="text-xs">
              {status.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkJobStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {jobStatus && jobStatus.status === 'SUCCESS' && !jobStatus.chunks_created && (
              <Button
                variant="outline"
                size="sm"
                onClick={retryProcessing}
                disabled={loading}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                Retry Processing
              </Button>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          {manual_id && `Manual ID: ${manual_id}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobStatus && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{processingStatus?.progress_percent || jobStatus.progress}%</span>
              </div>
              <Progress value={processingStatus?.progress_percent || jobStatus.progress} className="h-2" />
            </div>

            {/* Real-time processing details */}
            {processingStatus && (
              <div className="space-y-2 text-sm">
                {processingStatus.stage && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stage:</span>
                    <span className="capitalize">{processingStatus.stage.replace('_', ' ')}</span>
                  </div>
                )}
                
                {processingStatus.total_chunks > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Text Chunks:</span>
                    <span>{processingStatus.chunks_processed}/{processingStatus.total_chunks}</span>
                  </div>
                )}

                {processingStatus.total_figures > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Figures:</span>
                    <span>{processingStatus.figures_processed}/{processingStatus.total_figures}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-muted-foreground">Status</div>
                <div className="flex items-center space-x-1">
                  <StatusIcon className={`h-3 w-3 ${status.color}`} />
                  <span>{status.label}</span>
                </div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Job ID</div>
                <div className="font-mono text-xs truncate">{job_id}</div>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Timeline</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {getEstimatedTime()}
              </div>
              {lastChecked && (
                <div className="text-xs text-muted-foreground mt-1">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </div>
              )}
            </div>

            {jobStatus.status === 'SUCCESS' && jobStatus.chunks_created && (
              <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="text-sm">
                  <div className="font-medium text-green-900 dark:text-green-100">
                    Manual processed successfully!
                  </div>
                  <div className="text-green-700 dark:text-green-300">
                    Your manual is now searchable and ready for troubleshooting.
                  </div>
                </div>
              </div>
            )}

            {jobStatus.status === 'ERROR' && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div className="text-sm">
                  <div className="font-medium text-red-900 dark:text-red-100">
                    Processing failed
                  </div>
                  <div className="text-red-700 dark:text-red-300">
                    There was an error processing your manual. Please try uploading again.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!jobStatus && loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            <span className="ml-3 text-sm text-muted-foreground">Checking status...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}