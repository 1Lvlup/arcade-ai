import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Database, FileText, Loader2 } from 'lucide-react';

interface Manual {
  id: string;
  manual_id: string;
  title: string;
  source_filename: string;
  chunk_count: number;
}

interface ManualSelectorProps {
  selectedManualId?: string;
  onManualChange: (manualId: string | null, manualTitle: string | null) => void;
}

export function ManualSelector({ selectedManualId, onManualChange }: ManualSelectorProps) {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProcessedManuals();
  }, []);

  const fetchProcessedManuals = async () => {
    try {
      // Get documents
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id, manual_id, title, source_filename')
        .order('title');

      if (docsError) throw docsError;

      // Get chunk counts for all manuals
      const { data: chunks, error: chunksError } = await supabase
        .from('chunks_text')
        .select('manual_id');

      if (chunksError) throw chunksError;

      // Combine data and filter only processed manuals
      const manualsWithChunks = documents
        ?.map(doc => ({
          ...doc,
          chunk_count: chunks?.filter(chunk => chunk.manual_id === doc.manual_id).length || 0
        }))
        .filter(manual => manual.chunk_count > 0) || [];

      setManuals(manualsWithChunks);
    } catch (error) {
      console.error('Error fetching manuals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (value: string) => {
    if (value === 'all') {
      onManualChange(null, null);
    } else {
      const selectedManual = manuals.find(m => m.manual_id === value);
      onManualChange(
        value, 
        selectedManual?.title || selectedManual?.source_filename || null
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading manuals...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <FileText className="h-4 w-4 text-muted-foreground" />
      <Select 
        value={selectedManualId || 'all'} 
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="w-[250px] h-8 text-xs">
          <SelectValue placeholder="Select a manual" />
        </SelectTrigger>
        <SelectContent className="bg-background border border-border">
          <SelectItem value="all" className="text-xs">
            <div className="flex items-center space-x-2">
              <Database className="h-3 w-3" />
              <span>All Manuals</span>
              <Badge variant="secondary" className="text-xs">
                {manuals.length} available
              </Badge>
            </div>
          </SelectItem>
          {manuals.map((manual) => (
            <SelectItem key={manual.manual_id} value={manual.manual_id} className="text-xs">
              <div className="flex items-center justify-between w-full">
                <span className="truncate max-w-[180px]">
                  {manual.title || manual.source_filename}
                </span>
                <Badge variant="outline" className="text-xs ml-2">
                  {manual.chunk_count} chunks
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}