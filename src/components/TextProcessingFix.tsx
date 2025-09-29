import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, FileText, CheckCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TextProcessingFixProps {
  manualId: string;
  hasTextChunks: boolean;
  jobId?: string;
}

export const TextProcessingFix: React.FC<TextProcessingFixProps> = ({ 
  manualId, 
  hasTextChunks, 
  jobId 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const retryTextProcessing = useMutation({
    mutationFn: async () => {
      console.log(`🔄 Starting text processing retry for manual: ${manualId}`);
      
      const { data, error } = await supabase.functions.invoke('retry-text-processing', {
        body: { manual_id: manualId }
      });

      if (error) {
        console.error('❌ Text processing failed:', error);
        throw error;
      }

      console.log('✅ Text processing completed:', data);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Text Processing Complete!',
        description: `Successfully processed ${data.chunks_processed} text chunks.`,
      });
      
      // Refresh the queries to show new chunks
      queryClient.invalidateQueries({ queryKey: ['manual-chunks', manualId] });
      queryClient.invalidateQueries({ queryKey: ['manual-details', manualId] });
    },
    onError: (error) => {
      console.error('❌ Retry failed:', error);
      toast({
        title: 'Text Processing Failed',
        description: `Failed to process text chunks: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  if (hasTextChunks) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            Text Processing Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-700">
            Text chunks are available for this manual. You can now search and chat with the content.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-yellow-800">
          <AlertCircle className="h-5 w-5" />
          Missing Text Content
        </CardTitle>
        <CardDescription className="text-yellow-700">
          This manual has figures but no text chunks. The webhook likely timed out during processing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-yellow-300 bg-yellow-100">
          <FileText className="h-4 w-4" />
          <AlertDescription className="text-yellow-800">
            <strong>Issue:</strong> Text chunking was skipped because the webhook spent too much time processing images.
            <br />
            <strong>Solution:</strong> Retry text processing using the completed LlamaCloud job.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <p className="text-sm text-yellow-700">
            <strong>Manual ID:</strong> {manualId}
          </p>
          {jobId && (
            <p className="text-sm text-yellow-700">
              <strong>Job ID:</strong> {jobId}
            </p>
          )}
        </div>

        <Button
          onClick={() => retryTextProcessing.mutate()}
          disabled={retryTextProcessing.isPending}
          className="w-full"
          size="lg"
        >
          {retryTextProcessing.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Processing Text Chunks...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Retry Text Processing
            </>
          )}
        </Button>

        {retryTextProcessing.isPending && (
          <Alert className="border-blue-200 bg-blue-50">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-blue-800">
              Re-fetching completed job from LlamaCloud and processing text chunks...
              This may take 1-2 minutes.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};