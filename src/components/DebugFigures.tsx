import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bug, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DebugResult {
  figure_id: string;
  database_id: string;
  storage_path: string;
  current_caption: string | null;
  current_ocr: string | null;
  image_accessible: boolean;
  presign_test: any;
  openai_test: any;
}

interface DebugFiguresProps {
  manual_id: string;
}

export function DebugFigures({ manual_id }: DebugFiguresProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runDebug = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      console.log("🔍 Running figure debugging...");
      
      const { data, error } = await supabase.functions.invoke('debug-figures', {
        body: { manual_id }
      });

      if (error) {
        console.error("❌ Debug failed:", error);
        toast({
          title: "Debug Failed",
          description: error.message || "Unknown error occurred",
          variant: "destructive",
        });
        return;
      }

      console.log("✅ Debug completed:", data);
      setResults(data);
      
      toast({
        title: "Debug Completed",
        description: `Analyzed ${data.total_figures} figures`,
      });

    } catch (error) {
      console.error("❌ Debug error:", error);
      toast({
        title: "Debug Error",
        description: "Failed to run figure debugging",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (test: any) => {
    if (test?.success) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (test?.error) return <XCircle className="h-4 w-4 text-red-600" />;
    if (test?.skipped) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-gray-400" />;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Figure Enhancement Debugging
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDebug} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Debugging Figures...
            </>
          ) : (
            "Run Figure Debug Test"
          )}
        </Button>

        {results && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Debug Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Manual:</strong> {results.manual_id}
                </div>
                <div>
                  <strong>Total Figures:</strong> {results.total_figures}
                </div>
                <div>
                  <strong>OpenAI Configured:</strong> 
                  <Badge variant={results.openai_configured ? "default" : "destructive"} className="ml-2">
                    {results.openai_configured ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </div>

            {results.debug_results?.map((debug: DebugResult, index: number) => (
              <Card key={debug.figure_id} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    Figure: {debug.figure_id}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <strong>Database ID:</strong> {debug.database_id}
                    </div>
                    <div>
                      <strong>Current Caption:</strong> {debug.current_caption || "NULL"}
                    </div>
                    <div className="col-span-2">
                      <strong>Storage Path:</strong> 
                      <div className="text-muted-foreground break-all">
                        {debug.storage_path}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Test Results:</h5>
                    
                    <div className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">Direct Image Access</span>
                      <div className="flex items-center gap-2">
                        {debug.image_accessible ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <Badge variant={debug.image_accessible ? "default" : "destructive"}>
                          {debug.image_accessible ? "Accessible" : "Not Accessible"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">Presign Function</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(debug.presign_test)}
                        <Badge variant={debug.presign_test?.success ? "default" : "destructive"}>
                          {debug.presign_test?.success ? "Working" : 
                           debug.presign_test?.error ? "Error" : "Failed"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">OpenAI Enhancement</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(debug.openai_test)}
                        <Badge variant={
                          debug.openai_test?.success ? "default" : 
                          debug.openai_test?.skipped ? "secondary" : "destructive"
                        }>
                          {debug.openai_test?.success ? "Working" : 
                           debug.openai_test?.skipped ? debug.openai_test.skipped :
                           "Error"}
                        </Badge>
                      </div>
                    </div>

                    {debug.openai_test?.response && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                        <strong>OpenAI Response:</strong>
                        <div className="mt-1 text-green-800">
                          {typeof debug.openai_test.response === 'string' 
                            ? debug.openai_test.response.slice(0, 200)
                            : JSON.stringify(debug.openai_test.response).slice(0, 200)}...
                        </div>
                      </div>
                    )}

                    {(debug.presign_test?.error || debug.openai_test?.error) && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-xs">
                        <strong>Errors:</strong>
                        {debug.presign_test?.error && (
                          <div className="mt-1 text-red-800">
                            Presign: {typeof debug.presign_test.error === 'string' 
                              ? debug.presign_test.error 
                              : JSON.stringify(debug.presign_test.error)}
                          </div>
                        )}
                        {debug.openai_test?.error && (
                          <div className="mt-1 text-red-800">
                            OpenAI: {typeof debug.openai_test.error === 'string' 
                              ? debug.openai_test.error 
                              : JSON.stringify(debug.openai_test.error)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}