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
  const { toast } = useToast();

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

      // Refresh the page after a short delay
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
    <Button
      onClick={handleRetry}
      disabled={disabled || isRetrying}
      variant="outline"
      size="sm"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? 'Resuming...' : 'Resume Processing'}
    </Button>
  );
}
