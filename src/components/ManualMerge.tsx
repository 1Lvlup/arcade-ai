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
        description: `Merged ${data.merged_chunks} chunks, ${data.merged_figures} figures, ${data.added_qa} QA pairs`,
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

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <GitMerge className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Merge Manual Data</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Combine data from two manuals. The source manual's chunks, figures, and QA pairs will be merged into the target manual,
          deduplicating and enriching existing data.
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
                  manuals?.map((manual) => (
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
                  manuals?.map((manual) => (
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
          <div className="mt-4 rounded-md bg-green-50 dark:bg-green-950 p-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100">Merge Results</h4>
            <ul className="mt-2 space-y-1 text-sm text-green-800 dark:text-green-200">
              <li>✓ Merged {result.merged_chunks} text chunks</li>
              <li>✓ Merged {result.merged_figures} figures</li>
              <li>✓ Added {result.added_qa} QA pairs</li>
            </ul>
            <p className="mt-2 text-xs text-green-700 dark:text-green-300">
              Manual ID: {result.target_manual_id}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
