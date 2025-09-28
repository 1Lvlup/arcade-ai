import React from 'react';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, FileText } from 'lucide-react';

interface QuickRetryButtonProps {
  manualId: string;
  onSuccess?: () => void;
}

export const QuickRetryButton: React.FC<QuickRetryButtonProps> = ({ manualId, onSuccess }) => {
  const { toast } = useToast();

  const retryTextProcessing = useMutation({
    mutationFn: async () => {
      console.log(`🔄 Quick retry text processing for: ${manualId}`);
      
      const { data, error } = await supabase.functions.invoke('retry-text-processing', {
        body: { manual_id: manualId }
      });

      if (error) {
        console.error('❌ Quick retry failed:', error);
        throw error;
      }

      console.log('✅ Quick retry completed:', data);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Text Processing Complete!',
        description: `Successfully processed ${data.chunks_processed} text chunks.`,
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Quick Retry Failed',
        description: `${error.message}`,
        variant: 'destructive',
      });
    }
  });

  return (
    <Button
      onClick={() => retryTextProcessing.mutate()}
      disabled={retryTextProcessing.isPending}
      variant="outline"
      size="sm"
    >
      {retryTextProcessing.isPending ? (
        <>
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-2" />
          Quick Fix Text
        </>
      )}
    </Button>
  );
};