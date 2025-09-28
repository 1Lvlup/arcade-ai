import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RetryProcessingProps {
  jobId: string;
  manualId: string;
}

export function RetryProcessing({ jobId, manualId }: RetryProcessingProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      console.log('Retrying processing for job:', jobId, 'manual:', manualId);
      
      // Try the retry-text-processing function first since that's what works
      const { data, error } = await supabase.functions.invoke('retry-text-processing', {
        body: {
          manual_id: manualId
        }
      });

      if (error) {
        console.error('Retry error:', error);
        toast.error('Failed to retry processing: ' + error.message);
        return;
      }

      console.log('Retry response:', data);
      
      if (data?.success) {
        toast.success('Processing restarted successfully!');
        // Reload the page to show updated status
        window.location.reload();
      } else {
        toast.error(data?.message || 'Failed to retry processing');
      }
    } catch (error) {
      console.error('Retry processing error:', error);
      toast.error('Failed to retry processing');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Processing Issue Detected</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The document processing appears to have stalled. You can retry the processing to complete it.
        </p>
        <div className="space-y-2">
          <p className="text-xs"><strong>Job ID:</strong> {jobId}</p>
          <p className="text-xs"><strong>Manual:</strong> {manualId}</p>
        </div>
        <Button 
          onClick={handleRetry} 
          disabled={isRetrying}
          className="w-full"
        >
          {isRetrying ? 'Retrying...' : 'Retry Processing'}
        </Button>
      </CardContent>
    </Card>
  );
}