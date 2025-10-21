import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, GitMerge } from 'lucide-react';

export function ManualMerge() {
  const { toast } = useToast();
  const [sourceManualId, setSourceManualId] = useState('');
  const [targetManualId, setTargetManualId] = useState('');
  const [merging, setMerging] = useState(false);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Fetch available manuals
  const { data: manuals, isLoading } = useQuery({
    queryKey: ['manuals-for-merge'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_metadata')
        .select('manual_id, canonical_title, manufacturer, version')
        .order('canonical_title');

      if (error) throw error;
      return data;
    },
  });

  const handleMerge = async () => {
    if (!sourceManualId || !targetManualId) {
      toast({
        title: 'Missing selection',
        description: 'Please select both source and target manuals',
        variant: 'destructive',
      });
      return;
    }

    if (sourceManualId === targetManualId) {
      toast({
        title: 'Invalid selection',
        description: 'Source and target cannot be the same manual',
        variant: 'destructive',
      });
      return;
    }

    setMerging(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('merge-manual-data', {
        body: { source_manual_id: sourceManualId, target_manual_id: targetManualId },
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: 'Merge successful!',
        description: `Added ${data.merged_chunks} chunks, ${data.merged_figures} figures, ${data.added_qa} QA pairs. Updated ${data.updated_figures} existing figures.`,
      });
    } catch (error: any) {
      console.error('Merge error:', error);
      toast({
        title: 'Merge failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setMerging(false);
    }
  };

  const handleProcessOCR = async () => {
    if (!result?.target_manual_id) {
      toast({
        title: 'No manual to process',
        description: 'Complete a merge first',
        variant: 'destructive',
      });
      return;
    }

    setProcessingOCR(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-all-ocr', {
        body: { manual_id: result.target_manual_id },
      });

      if (error) throw error;

      toast({
        title: 'OCR processing started',
        description: `Processing ${data.total_figures} figures. This may take several minutes.`,
      });
    } catch (error: any) {
      console.error('OCR processing error:', error);
      toast({
        title: 'OCR processing failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingOCR(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <GitMerge className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Merge Manual Data</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          <strong>Important:</strong> This merges data FROM a source manual INTO an existing target manual. 
          It doesn't create a new manual - it enriches the target with chunks, figures, and QA pairs from the source.
          After merging, click the OCR button below to generate captions and text for all figures.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Source Manual (will be merged from)</label>
            <Select value={sourceManualId} onValueChange={setSourceManualId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source manual" />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="p-2 text-sm text-muted-foreground">Loading manuals...</div>
                ) : (
                  manuals?.filter(m => m.manual_id && m.manual_id.trim() !== '').map((manual) => (
                    <SelectItem key={manual.manual_id} value={manual.manual_id}>
                      {manual.canonical_title} {manual.version && `(${manual.version})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Target Manual (will receive merged data)</label>
            <Select value={targetManualId} onValueChange={setTargetManualId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target manual" />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="p-2 text-sm text-muted-foreground">Loading manuals...</div>
                ) : (
                  manuals?.filter(m => m.manual_id && m.manual_id.trim() !== '').map((manual) => (
                    <SelectItem key={manual.manual_id} value={manual.manual_id}>
                      {manual.canonical_title} {manual.version && `(${manual.version})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleMerge} 
            disabled={merging || !sourceManualId || !targetManualId}
            className="w-full"
          >
            {merging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4" />
                Merge Manuals
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-green-50 dark:bg-green-950 p-4">
              <h4 className="font-semibold text-green-900 dark:text-green-100">Merge Results</h4>
              <ul className="mt-2 space-y-1 text-sm text-green-800 dark:text-green-200">
                <li>✓ Added {result.merged_chunks} new text chunks (skipped {result.skipped_chunk_duplicates} duplicates)</li>
                <li>✓ Added {result.merged_figures} new figures, enriched {result.updated_figures} existing (skipped {result.skipped_figure_duplicates} duplicates)</li>
                <li>✓ Added {result.added_qa} QA pairs (skipped {result.skipped_qa_duplicates} duplicates)</li>
                <li className="font-semibold pt-1">Total: {result.total_items_merged} items merged</li>
              </ul>
              <p className="mt-2 text-xs text-green-700 dark:text-green-300">
                Merged "{result.source_manual_title}" into "{result.target_manual_title}"
              </p>
              <p className="mt-2 text-xs font-medium text-green-800 dark:text-green-200">
                ℹ️ The data has been merged into the existing manual: {result.target_manual_id}
              </p>
            </div>

            <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Process Figure OCR & Captions</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Generate OCR text and AI captions for all figures in the merged manual. This will help improve search and retrieval.
              </p>
              <Button
                onClick={handleProcessOCR}
                disabled={processingOCR}
                variant="outline"
                className="w-full"
              >
                {processingOCR ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing OCR...
                  </>
                ) : (
                  'Process OCR & Captions'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
