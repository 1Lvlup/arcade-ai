import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EnhancementResult {
  processed: number;
  successful: number;
  errors: number;
  done: boolean;
  message?: string;
  results?: Array<{
    id: string;
    figure_id: string;
    ok: boolean;
    caption?: boolean;
    ocr?: boolean;
    error?: string;
  }>;
}

const FigureEnhancementManager: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<EnhancementResult | null>(null);
  const { toast } = useToast();

  const runEnhancement = async () => {
    setIsProcessing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('enhance-figures');
      
      if (error) {
        throw error;
      }

      const result = data as EnhancementResult;
      setResults(result);

      if (result.done) {
        toast({
          title: "Enhancement Complete",
          description: "All figures have been processed",
        });
      } else {
        toast({
          title: "Batch Processed",
          description: `Processed ${result.processed} figures. ${result.successful} successful, ${result.errors} errors.`,
        });
      }
    } catch (error) {
      console.error('Enhancement error:', error);
      toast({
        title: "Enhancement Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Figure Enhancement Manager
        </CardTitle>
        <CardDescription>
          Process figures in batches to add AI-generated captions and OCR text
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This processes figures in small batches (3-5 at a time) to avoid timeouts. 
            You may need to run this multiple times to process all figures.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={runEnhancement} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Batch...
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Process Next Batch
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-blue-50 p-2 rounded text-center">
                <div className="font-semibold text-blue-700">{results.processed}</div>
                <div className="text-blue-600">Processed</div>
              </div>
              <div className="bg-green-50 p-2 rounded text-center">
                <div className="font-semibold text-green-700">{results.successful}</div>
                <div className="text-green-600">Successful</div>
              </div>
              <div className="bg-red-50 p-2 rounded text-center">
                <div className="font-semibold text-red-700">{results.errors}</div>
                <div className="text-red-600">Errors</div>
              </div>
            </div>

            {results.done && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All figures have been processed! No more figures need enhancement.
                </AlertDescription>
              </Alert>
            )}

            {results.results && results.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Batch Results:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {results.results.map((result, index) => (
                    <div 
                      key={index} 
                      className={`p-2 rounded text-xs flex items-center justify-between ${
                        result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      <span className="font-mono">{result.figure_id}</span>
                      <div className="flex items-center gap-1">
                        {result.ok ? (
                          <>
                            {result.caption && <FileText className="h-3 w-3" />}
                            {result.ocr && <Eye className="h-3 w-3" />}
                            <CheckCircle className="h-3 w-3" />
                          </>
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FigureEnhancementManager;