import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { SharedHeader } from "@/components/SharedHeader";

const ReIngestManual = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const MANUAL_ID = "down-the-clown-combined-10-21-25-current";

  const handleReIngest = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('reingest-manual', {
        body: { manual_id: MANUAL_ID }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "Re-ingestion Complete",
        description: `Created ${data.chunks_created} chunks and re-embedded ${data.figures_reembedded} figures`,
      });
    } catch (error: any) {
      console.error('Re-ingestion error:', error);
      toast({
        title: "Re-ingestion Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <p><strong>Manual ID:</strong> {MANUAL_ID}</p>
              <p><strong>What this does:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Sets page_count from existing chunks</li>
                <li>Re-chunks to 350-450 chars with validation</li>
                <li>Generates new embeddings for all chunks</li>
                <li>Re-embeds figures with ±2 page context</li>
                <li>Backfills metadata (manufacturer, platform, etc.)</li>
              </ul>
            </div>

            <Button
              onClick={handleReIngest}
              disabled={isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? "Processing..." : "Start Re-Ingestion"}
            </Button>

            {result && (
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg space-y-2">
                <p className="font-semibold text-green-900 dark:text-green-100">✅ Success!</p>
                <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                  <p>Page Count: {result.page_count}</p>
                  <p>Chunks Created: {result.chunks_created}</p>
                  <p>Figures Re-embedded: {result.figures_reembedded}</p>
                  <p>Metadata Backfilled: {result.metadata_backfilled?.total || 0} records</p>
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
