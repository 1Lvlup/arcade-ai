import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Database, Gamepad2, Loader2 } from 'lucide-react';

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
      const { data: docs, error: directError } = await supabase
        .from('documents')
        .select('id, manual_id, title, source_filename')
        .order('title');

      if (directError) throw directError;

      // Get counts separately for each manual using count query
      const manualsWithCounts = await Promise.all(
        (docs || []).map(async (doc) => {
          const { count } = await supabase
            .from('chunks_text')
            .select('*', { count: 'exact', head: true })
            .eq('manual_id', doc.manual_id);
          
          return {
            ...doc,
            chunk_count: count || 0
          };
        })
      );

      setManuals(manualsWithCounts.filter(m => m.chunk_count > 0));
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
        <span>Loading games...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Gamepad2 className="h-4 w-4 text-muted-foreground" />
      <Select 
        value={selectedManualId || 'all'} 
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="w-[250px] h-8 text-xs">
          <SelectValue placeholder="Select a game" />
        </SelectTrigger>
        <SelectContent className="bg-background border border-border">
          <SelectItem value="all" className="text-xs">
            <div className="flex items-center space-x-2">
              <Database className="h-3 w-3" />
              <span>All Games</span>
              <Badge variant="secondary" className="text-xs">
                {manuals.length} games
              </Badge>
            </div>
          </SelectItem>
          {manuals.map((manual) => (
            <SelectItem key={manual.manual_id} value={manual.manual_id} className="text-xs">
              <div className="flex items-center justify-between w-full">
                <span className="truncate max-w-[180px]">
                  {manual.title || manual.source_filename}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}