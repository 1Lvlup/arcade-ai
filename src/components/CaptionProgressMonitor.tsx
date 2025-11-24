import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, Image, CheckCircle, AlertCircle, Play } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CaptionProgressMonitorProps {
  manualId: string;
  onComplete?: () => void;
}

interface ProcessingStatus {
  status: string;
  stage: string;
  current_task: string;
  total_figures: number;
  figures_processed: number;
  progress_percent: number;
  updated_at: string;
}

const CaptionProgressMonitor: React.FC<CaptionProgressMonitorProps> = ({ manualId, onComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [uncaptionedCount, setUncaptionedCount] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch current uncaptioned figures count
  const fetchUncaptionedCount = async () => {
    const { count } = await supabase
      .from('figures')
      .select('*', { count: 'exact', head: true })
      .eq('manual_id', manualId)
      .is('caption_text', null);
    
    setUncaptionedCount(count || 0);
  };

  // Fetch processing status
  const fetchStatus = async () => {
    const { data } = await supabase
      .from('processing_status')
      .select('*')
      .eq('manual_id', manualId)
      .eq('stage', 'caption_generation')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setStatus(data as ProcessingStatus);
      
      // If status is processing, keep polling
      if (data.status === 'processing') {
        setIsProcessing(true);
      } else if (data.status === 'completed') {
        setIsProcessing(false);
        if (onComplete) onComplete();
      }
    }
  };

  // Poll for updates while processing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isProcessing) {
      interval = setInterval(() => {
        fetchStatus();
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, manualId]);

  // Initial load
  useEffect(() => {
    fetchUncaptionedCount();
    fetchStatus();
  }, [manualId]);

  const startCaptionGeneration = async () => {
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-figure-captions', {
        body: { manual_id: manualId }
      });

      if (error) throw error;

      toast({
        title: "Caption Processing Started",
        description: `Processing ${data.total} figures in the background`,
      });

      // Start polling
      setTimeout(fetchStatus, 1000);
    } catch (error) {
      console.error('Caption generation error:', error);
      toast({
        title: "Failed to Start Processing",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const progressPercent = status?.progress_percent || 0;
  const processed = status?.figures_processed || 0;
  const total = status?.total_figures || uncaptionedCount || 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Figure Caption Generation
        </CardTitle>
        <CardDescription>
          AI captions are generated automatically after PDF processing. Click below to start processing manually if needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isProcessing && uncaptionedCount !== null && uncaptionedCount > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {uncaptionedCount} figures need captions. Captions generate automatically after upload, or click below to start manually.
            </AlertDescription>
          </Alert>
        )}

        {!isProcessing && uncaptionedCount === 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              All figures have captions! ✨
            </AlertDescription>
          </Alert>
        )}

        {status && isProcessing && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{processed} / {total} figures</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">{progressPercent}% complete</p>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {status.current_task}
              </p>
            </div>
          </div>
        )}

        {status && !isProcessing && status.status === 'completed' && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              {status.current_task}
            </AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={startCaptionGeneration} 
          disabled={isProcessing || uncaptionedCount === 0}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing... ({processed}/{total})
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              {uncaptionedCount === 0 ? 'All Captions Complete' : `Generate Captions (${uncaptionedCount} figures)`}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CaptionProgressMonitor;
