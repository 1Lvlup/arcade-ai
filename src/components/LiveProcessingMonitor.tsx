import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

interface ProcessingStatus {
  id: string;
  job_id: string;
  manual_id: string;
  status: string;
  stage: string | null;
  current_task: string | null;
  progress_percent: number;
  total_chunks: number;
  chunks_processed: number;
  total_figures: number;
  figures_processed: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ProcessingLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export const LiveProcessingMonitor = () => {
  const [activeJobs, setActiveJobs] = useState<ProcessingStatus[]>([]);
  const [logs, setLogs] = useState<Record<string, ProcessingLog[]>>({});

  useEffect(() => {
    // Load initial active jobs (only from last 6 hours)
    const loadActiveJobs = async () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      
      const { data } = await supabase
        .from('processing_status')
        .select('*')
        .in('status', ['starting', 'processing', 'pending'])
        .gte('created_at', sixHoursAgo)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setActiveJobs(data);
        
        // Auto-cleanup stale jobs on mount
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const staleJobs = data.filter(job => 
          job.updated_at < twoHoursAgo && 
          ['starting', 'processing', 'pending'].includes(job.status)
        );
        
        if (staleJobs.length > 0) {
          console.log('Auto-cleaning stale jobs:', staleJobs.length);
          supabase.functions.invoke('cleanup-stale-jobs').catch(console.error);
        }
      }
    };

    loadActiveJobs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('processing-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processing_status',
        },
        (payload) => {
          const newStatus = payload.new as ProcessingStatus;
          const oldStatus = payload.old as ProcessingStatus;

          // Add log entry
          if (payload.eventType === 'UPDATE' && newStatus) {
            const jobId = newStatus.job_id;
            const timestamp = new Date().toLocaleTimeString();
            
            let logMessage = '';
            let logType: 'info' | 'success' | 'error' | 'warning' = 'info';

            if (newStatus.status !== oldStatus?.status) {
              logMessage = `Status changed: ${oldStatus?.status} → ${newStatus.status}`;
              logType = newStatus.status === 'completed' ? 'success' : newStatus.status === 'error' ? 'error' : 'info';
            } else if (newStatus.current_task !== oldStatus?.current_task) {
              logMessage = `Task: ${newStatus.current_task}`;
            } else if (newStatus.progress_percent !== oldStatus?.progress_percent) {
              logMessage = `Progress: ${newStatus.progress_percent}%`;
            } else if (newStatus.chunks_processed !== oldStatus?.chunks_processed) {
              logMessage = `Chunks processed: ${newStatus.chunks_processed}/${newStatus.total_chunks}`;
            } else if (newStatus.figures_processed !== oldStatus?.figures_processed) {
              logMessage = `Figures processed: ${newStatus.figures_processed}/${newStatus.total_figures}`;
            }

            if (logMessage) {
              setLogs(prev => ({
                ...prev,
                [jobId]: [
                  ...(prev[jobId] || []),
                  { timestamp, message: logMessage, type: logType }
                ].slice(-50) // Keep last 50 logs
              }));
            }
          }

          // Update active jobs list
          if (payload.eventType === 'INSERT') {
            setActiveJobs(prev => [newStatus, ...prev].slice(0, 5));
          } else if (payload.eventType === 'UPDATE') {
            setActiveJobs(prev =>
              prev.map(job => job.id === newStatus.id ? newStatus : job)
            );
          } else if (payload.eventType === 'DELETE') {
            setActiveJobs(prev => prev.filter(job => job.id !== oldStatus.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'processing':
      case 'starting':
        return <Loader2 className="h-5 w-5 text-orange animate-spin" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-destructive';
      case 'processing':
        return 'bg-orange';
      case 'starting':
        return 'bg-cyan';
      default:
        return 'bg-muted';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return '📊';
    }
  };

  if (activeJobs.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full space-y-2">
      {activeJobs.map((job) => (
        <Card key={job.id} className="premium-card border-orange/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-tech flex items-center gap-2">
                {getStatusIcon(job.status)}
                Processing: {job.manual_id.slice(0, 12)}...
              </CardTitle>
              <Badge variant="outline" className={getStatusColor(job.status)}>
                {job.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {job.current_task && (
              <p className="text-xs text-muted-foreground">{job.current_task}</p>
            )}
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Progress</span>
                <span className="text-orange">{job.progress_percent}%</span>
              </div>
              <Progress value={job.progress_percent} className="h-2" />
            </div>

            {job.total_chunks > 0 && (
              <div className="text-xs text-muted-foreground">
                Chunks: {job.chunks_processed}/{job.total_chunks}
              </div>
            )}

            {job.total_figures > 0 && (
              <div className="text-xs text-muted-foreground">
                Figures: {job.figures_processed}/{job.total_figures}
              </div>
            )}

            {logs[job.job_id] && logs[job.job_id].length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto space-y-1 text-xs font-mono bg-black/20 rounded p-2">
                {logs[job.job_id].slice(-10).map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-muted-foreground">{log.timestamp}</span>
                    <span>{getLogIcon(log.type)}</span>
                    <span className={
                      log.type === 'error' ? 'text-destructive' :
                      log.type === 'success' ? 'text-green-500' :
                      log.type === 'warning' ? 'text-yellow-500' :
                      'text-cyan'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {job.error_message && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {job.error_message}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};