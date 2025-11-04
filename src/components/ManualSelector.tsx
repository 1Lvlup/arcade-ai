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
      // First get the user's tenant to find accessible manuals
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get user's profile to find their tenant
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get accessible manual IDs from tenant_manual_access
      const { data: accessibleManuals, error: accessError } = await supabase
        .from('tenant_manual_access')
        .select('manual_id')
        .eq('fec_tenant_id', profile.fec_tenant_id);

      if (accessError) throw accessError;

      if (!accessibleManuals || accessibleManuals.length === 0) {
        console.log('No manuals accessible for this tenant');
        setManuals([]);
        return;
      }

      const manualIds = accessibleManuals.map(m => m.manual_id);

      // Get documents for accessible manuals
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, manual_id, title, source_filename')
        .in('manual_id', manualIds)
        .order('title');

      if (docsError) throw docsError;

      // Get counts separately for each manual
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
    <div className="w-full">
      <div className="mb-2 flex items-center gap-2">
        <Gamepad2 className="h-5 w-5 text-orange" />
        <span className="text-sm font-semibold text-foreground">Choose Your Game</span>
        <Badge variant="default" className="bg-orange text-white text-xs">Required</Badge>
      </div>
      <Select 
        value={selectedManualId || 'all'} 
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="w-full h-12 text-base border-2 border-orange/50 hover:border-orange transition-colors bg-card/50 backdrop-blur-sm">
          <SelectValue placeholder="👉 Select a game to get started" />
        </SelectTrigger>
        <SelectContent className="bg-background border-2 border-border z-50">
          <SelectItem value="all" className="text-sm py-3">
            <div className="flex items-center space-x-3">
              <Database className="h-4 w-4 text-primary" />
              <span className="font-medium">All Games</span>
              <Badge variant="secondary" className="text-xs">
                {manuals.length} games
              </Badge>
            </div>
          </SelectItem>
          {manuals.map((manual) => (
            <SelectItem key={manual.manual_id} value={manual.manual_id} className="text-sm py-3">
              <div className="flex items-center justify-between w-full">
                <span className="truncate max-w-[280px] font-medium">
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