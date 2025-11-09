import { useState } from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Loader2 } from 'lucide-react';

interface ManualSyncButtonProps {
  manualId: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const ManualSyncButton = ({ manualId, size = 'sm' }: ManualSyncButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-processing-status', {
        body: { manual_id: manualId }
      });

      if (error) throw error;

      toast({
        title: 'Sync Complete',
        description: `Updated status: ${data.status || 'Unknown'}`,
      });
    } catch (error) {
      console.error('Error syncing processing status:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync processing status.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSync}
      disabled={isLoading}
      variant="outline"
      size={size}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Sync Status
    </Button>
  );
};
