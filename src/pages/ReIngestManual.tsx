import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { SharedHeader } from "@/components/SharedHeader";

const ReIngestManual = () => {
  const [isProcessingChunks, setIsProcessingChunks] = useState(false);
  const [isProcessingFigures, setIsProcessingFigures] = useState(false);
  const [chunkResult, setChunkResult] = useState<any>(null);
  const [figureResult, setFigureResult] = useState<any>(null);
  const { toast } = useToast();

  const MANUAL_ID = "down-the-clown-combined-10-21-25-current";

  const handleReIngestChunks = async () => {
    setIsProcessingChunks(true);
    setChunkResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('reingest-manual', {
        body: { manual_id: MANUAL_ID, step: 'chunks' }
      });

      if (error) throw error;

      setChunkResult(data);
      toast({
        title: "Chunks Re-ingested",
        description: `Created ${data.chunks_created} chunks with validated page numbers`,
      });
    } catch (error: any) {
      console.error('Chunks error:', error);
      toast({
        title: "Chunks Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessingChunks(false);
    }
  };

  const handleReIngestFigures = async () => {
    setIsProcessingFigures(true);
    setFigureResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('reingest-manual', {
        body: { manual_id: MANUAL_ID, step: 'figures' }
      });

      if (error) throw error;

      setFigureResult(data);
      toast({
        title: "Figures Re-embedding Started",
        description: `Processing ${data.total_figures} figures in background`,
      });
    } catch (error: any) {
      console.error('Figures error:', error);
      toast({
        title: "Figures Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessingFigures(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Manual Re-Ingestion" />
      
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Re-Ingest Down the Clown</CardTitle>
            <CardDescription>
              This will re-process the manual with validated chunking and figure embeddings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <p><strong>Manual ID:</strong> {MANUAL_ID}</p>
              <p><strong>What this does:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Step 1 (Chunks):</strong> Re-chunks text to 350-450 chars with page validation</li>
                <li><strong>Step 2 (Figures):</strong> Re-embeds all figures with ±2 page context</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleReIngestChunks}
                disabled={isProcessingChunks}
                className="w-full"
                size="lg"
                variant="default"
              >
                {isProcessingChunks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessingChunks ? "Processing Chunks..." : "Step 1: Re-Ingest Chunks"}
              </Button>

              <Button
                onClick={handleReIngestFigures}
                disabled={isProcessingFigures}
                className="w-full"
                size="lg"
                variant="secondary"
              >
                {isProcessingFigures && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessingFigures ? "Starting..." : "Step 2: Re-Embed Figures"}
              </Button>
            </div>

            {chunkResult && (
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg space-y-2">
                <p className="font-semibold text-green-900 dark:text-green-100">✅ Chunks Complete!</p>
                <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                  <p>Page Count: {chunkResult.page_count}</p>
                  <p>Chunks Created: {chunkResult.chunks_created}</p>
                  <p>Metadata Backfilled: {chunkResult.metadata_backfilled?.total || 0} records</p>
                </div>
              </div>
            )}

            {figureResult && (
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
                <p className="font-semibold text-blue-900 dark:text-blue-100">✅ Figures Started!</p>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <p>{figureResult.message}</p>
                  <p>Total Figures: {figureResult.total_figures}</p>
                  <p className="text-xs mt-2">Processing in background - check edge function logs for progress</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReIngestManual;
