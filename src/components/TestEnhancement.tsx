import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function TestEnhancement() {
  const [isLoading, setIsLoading] = useState(false);
  const [figureId, setFigureId] = useState("");
  const [manualId, setManualId] = useState("");
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runTest = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      console.log("🧪 Testing enhancement pipeline...");
      
      const { data, error } = await supabase.functions.invoke('test-enhancement', {
        body: { 
          figure_id: figureId || null, 
          manual_id: manualId || null 
        }
      });

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
        description: `Processed ${data.processed} figures`,
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="figureId">Figure ID (optional)</Label>
            <Input
              id="figureId"
              placeholder="Enter specific figure ID"
              value={figureId}
              onChange={(e) => setFigureId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="manualId">Manual ID (optional)</Label>
            <Input
              id="manualId"
              placeholder="Enter manual ID"
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
              <p><strong>Status:</strong> {results.success ? "✅ Success" : "❌ Failed"}</p>
              <p><strong>Processed:</strong> {results.processed} figures</p>
            </div>

            {results.results && results.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Figure Results:</h4>
                {results.results.map((result: any, index: number) => (
                  <div key={index} className="bg-card border rounded p-3 text-sm">
                    <p><strong>Figure ID:</strong> {result.figure_id}</p>
                    <p><strong>Status:</strong> {result.status}</p>
                    {result.new_caption && (
                      <p><strong>New Caption:</strong> {result.new_caption}</p>
                    )}
                    {result.new_ocr && (
                      <p><strong>New OCR:</strong> {result.new_ocr}</p>
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