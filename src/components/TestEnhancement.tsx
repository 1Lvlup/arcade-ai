import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TestTube, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TestEnhancement() {
  const [isLoading, setIsLoading] = useState(false);
  const [figureId, setFigureId] = useState("");
  const [manualId, setManualId] = useState("");
  const [results, setResults] = useState<any>(null);
  const [availableData, setAvailableData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load available data on component mount
    loadAvailableData();
  }, []);

  const loadAvailableData = async () => {
    try {
      const { data: figures } = await supabase
        .from('figures')
        .select('id, manual_id, caption_text, ocr_text')
        .limit(10);
      
      const { data: manuals } = await supabase
        .from('documents')
        .select('manual_id, title')
        .limit(10);

      setAvailableData({ figures, manuals });
    } catch (error) {
      console.error('Failed to load available data:', error);
    }
  };

  const runTest = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      console.log("🧪 Testing enhancement pipeline...");
      console.log("📋 Request params:", { figureId, manualId });
      
      const { data, error } = await supabase.functions.invoke('test-enhancement', {
        body: { 
          figure_id: figureId || null, 
          manual_id: manualId || null 
        }
      });

      console.log("📡 Function response:", { data, error });

      if (error) {
        console.error("❌ Test failed:", error);
        toast({
          title: "Test Failed",
          description: error.message || "Unknown error occurred",
          variant: "destructive",
        });
        return;
      }

      console.log("✅ Test completed:", data);
      setResults(data);
      
      toast({
        title: "Test Completed",
        description: `Processed ${data?.results?.length || 0} figures`,
      });

    } catch (error) {
      console.error("❌ Test error:", error);
      toast({
        title: "Test Error",
        description: "Failed to run enhancement test",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test OpenAI Enhancement Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>How it works:</strong> Leave fields blank to test any 5 figures, or specify a manual/figure ID. 
            The test will fetch images, send them to OpenAI for caption generation and OCR, then update the database.
          </AlertDescription>
        </Alert>

        {availableData && (
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Available Data:</h4>
            <div className="text-xs space-y-1">
              <p><strong>Manuals:</strong> {availableData.manuals?.map((m: any) => m.manual_id).join(', ') || 'None'}</p>
              <p><strong>Sample Figure IDs:</strong> {availableData.figures?.slice(0, 3).map((f: any) => f.id.slice(0, 8) + '...').join(', ') || 'None'}</p>
              <p><strong>Missing Enhancements:</strong> {availableData.figures?.filter((f: any) => !f.caption_text && !f.ocr_text).length || 0} figures need enhancement</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="figureId">Figure ID (optional)</Label>
            <Input
              id="figureId"
              placeholder="Leave blank to test any figures"
              value={figureId}
              onChange={(e) => setFigureId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="manualId">Manual ID (optional)</Label>
            <Input
              id="manualId"
              placeholder="e.g., all-in (leave blank for any)"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
            />
          </div>
        </div>

        <Button 
          onClick={runTest} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing Enhancement...
            </>
          ) : (
            "Run Enhancement Test"
          )}
        </Button>

        {results && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold">Test Results</h3>
            <div className="bg-muted p-4 rounded-lg">
              <p><strong>Status:</strong> {results.results && results.results.length > 0 ? "✅ Success" : "❌ Failed"}</p>
              <p><strong>Message:</strong> {results.message || "No message"}</p>
              <p><strong>Processed:</strong> {results.results?.length || 0} figures</p>
            </div>

            {results.results && results.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Figure Results:</h4>
                {results.results.map((result: any, index: number) => (
                  <div key={index} className="bg-card border rounded p-3 text-sm">
                    <p><strong>Figure ID:</strong> {result.figure_id}</p>
                    <p><strong>Manual ID:</strong> {result.manual_id}</p>
                    <p><strong>Enhanced:</strong> {result.enhanced ? "✅ Yes" : "❌ No"}</p>
                    {result.caption && (
                      <p><strong>Caption:</strong> {result.caption.substring(0, 200)}...</p>
                    )}
                    {result.ocr_text && (
                      <p><strong>OCR Text:</strong> {result.ocr_text}</p>
                    )}
                    {result.error && (
                      <p className="text-destructive"><strong>Error:</strong> {result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}