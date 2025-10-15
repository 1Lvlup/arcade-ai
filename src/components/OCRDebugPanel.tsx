import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface OCRDebugData {
  id: string;
  manual_id: string;
  page_number: number;
  llama_asset_name: string;
  ocr_status: string;
  ocr_text: string | null;
  ocr_confidence: number | null;
  caption_text: string | null;
  raw_image_metadata: any;
  created_at: string;
}

interface OCRDebugPanelProps {
  manualId: string;
}

export function OCRDebugPanel({ manualId }: OCRDebugPanelProps) {
  const [figures, setFigures] = useState<OCRDebugData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFigures();
    
    // Subscribe to changes
    const channel = supabase
      .channel('ocr-debug')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'figures',
          filter: `manual_id=eq.${manualId}`
        },
        () => {
          loadFigures();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [manualId]);

  const loadFigures = async () => {
    try {
      const { data, error } = await supabase
        .from('figures')
        .select('id, manual_id, page_number, llama_asset_name, ocr_status, ocr_text, ocr_confidence, caption_text, raw_image_metadata, created_at')
        .eq('manual_id', manualId)
        .order('page_number', { ascending: true });

      if (error) throw error;
      setFigures(data || []);
    } catch (error) {
      console.error('Error loading figures:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const hasLlamaOCR = (metadata: any) => {
    return metadata?.ocr && Array.isArray(metadata.ocr) && metadata.ocr.length > 0;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const stats = {
    total: figures.length,
    withLlamaOCR: figures.filter(f => hasLlamaOCR(f.raw_image_metadata)).length,
    completed: figures.filter(f => f.ocr_status === 'completed').length,
    pending: figures.filter(f => f.ocr_status === 'pending').length,
    failed: figures.filter(f => f.ocr_status === 'failed').length,
    hasText: figures.filter(f => f.ocr_text && f.ocr_text.length > 0).length,
    hasCaption: figures.filter(f => f.caption_text && f.caption_text.length > 0).length,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>OCR Processing Debug Panel</CardTitle>
        <CardDescription>
          Real-time OCR extraction status for all figures
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-primary/10 rounded-lg">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Figures</div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <div className="text-2xl font-bold">{stats.withLlamaOCR}</div>
            <div className="text-sm text-muted-foreground">LlamaCloud OCR</div>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg">
            <div className="text-2xl font-bold">{stats.hasText}</div>
            <div className="text-sm text-muted-foreground">Has OCR Text</div>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-lg">
            <div className="text-2xl font-bold">{stats.hasCaption}</div>
            <div className="text-sm text-muted-foreground">Has Caption</div>
          </div>
        </div>

        {/* Detailed List */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {figures.map((figure) => {
              const llamaOCR = hasLlamaOCR(figure.raw_image_metadata);
              const llamaOCRCount = llamaOCR ? figure.raw_image_metadata.ocr.length : 0;

              return (
                <div key={figure.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(figure.ocr_status)}
                      <span className="font-medium">Page {figure.page_number}</span>
                      <Badge variant="outline">{figure.llama_asset_name}</Badge>
                    </div>
                    <Badge variant={figure.ocr_status === 'completed' ? 'default' : 'secondary'}>
                      {figure.ocr_status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">LlamaCloud OCR:</span>{' '}
                      {llamaOCR ? (
                        <span className="text-green-600 font-medium">✓ {llamaOCRCount} segments</span>
                      ) : (
                        <span className="text-red-600">✗ None</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">OCR Text:</span>{' '}
                      {figure.ocr_text ? (
                        <span className="text-green-600 font-medium">✓ {figure.ocr_text.length} chars</span>
                      ) : (
                        <span className="text-gray-500">None</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Confidence:</span>{' '}
                      {figure.ocr_confidence ? (
                        <span className="font-medium">{(figure.ocr_confidence * 100).toFixed(1)}%</span>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Caption:</span>{' '}
                      {figure.caption_text ? (
                        <span className="text-green-600 font-medium">✓ {figure.caption_text.length} chars</span>
                      ) : (
                        <span className="text-gray-500">None</span>
                      )}
                    </div>
                  </div>

                  {figure.ocr_text && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <strong>OCR Preview:</strong> {figure.ocr_text.substring(0, 150)}...
                    </div>
                  )}

                  {llamaOCR && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View raw LlamaCloud metadata
                      </summary>
                      <pre className="mt-2 bg-muted/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(figure.raw_image_metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
