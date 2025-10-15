import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface RetryProcessingButtonProps {
  manualId: string;
  disabled?: boolean;
}

export function RetryProcessingButton({ manualId, disabled }: RetryProcessingButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-processing-status', {
        body: { manual_id: manualId }
      });

      if (error) throw error;

      toast({
        title: 'Status synced',
        description: data.message,
      });

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('retry-processing', {
        body: { manual_id: manualId }
      });

      if (error) throw error;

      toast({
        title: 'Processing resumed',
        description: data.message || `Processing ${data.processed_count} pending figures`,
      });

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Retry error:', error);
      toast({
        title: 'Retry failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleSync}
        disabled={disabled || isSyncing}
        variant="outline"
        size="sm"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Sync Status'}
      </Button>
      <Button
        onClick={handleRetry}
        disabled={disabled || isRetrying}
        variant="outline"
        size="sm"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
        {isRetrying ? 'Resuming...' : 'Resume Processing'}
      </Button>
    </div>
  );
}
