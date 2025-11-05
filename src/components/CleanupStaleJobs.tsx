import { useState } from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Loader2 } from 'lucide-react';

export const CleanupStaleJobs = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCleanup = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-stale-jobs');

      if (error) throw error;

      toast({
        title: 'Cleanup Complete',
        description: `Marked ${data.cleaned_count} stale job(s) as failed.`,
      });
    } catch (error) {
      console.error('Error cleaning up stale jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to cleanup stale jobs.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCleanup}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      Clean Up Stale Jobs
    </Button>
  );
};