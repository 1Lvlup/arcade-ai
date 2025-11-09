import { useState, useEffect } from 'react';
import { Gamepad2, ChevronRight, Plus, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { GameRequestDialog } from '@/components/GameRequestDialog';

interface Manual {
  id: string;
  manual_id: string;
  title: string;
  source_filename: string;
  chunk_count: number;
}

interface GameSidebarProps {
  selectedManualId?: string;
  onManualChange: (manualId: string | null, manualTitle: string | null) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function GameSidebar({ selectedManualId, onManualChange, isCollapsed, onToggleCollapse }: GameSidebarProps) {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProcessedManuals();
  }, []);

  const fetchProcessedManuals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      const { data: accessibleManuals, error: accessError } = await supabase
        .from('tenant_manual_access')
        .select('manual_id')
        .eq('fec_tenant_id', profile.fec_tenant_id);

      if (accessError) throw accessError;

      if (!accessibleManuals || accessibleManuals.length === 0) {
        setManuals([]);
        return;
      }

      const manualIds = accessibleManuals.map(m => m.manual_id);

      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, manual_id, title, source_filename')
        .in('manual_id', manualIds)
        .order('title');

      if (docsError) throw docsError;

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

  const handleGameSelect = (manual: Manual) => {
    onManualChange(manual.manual_id, manual.title || manual.source_filename);
  };

  const handleToggle = () => {
    console.log('Toggle clicked, current collapsed:', isCollapsed);
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  if (isCollapsed) {
    return (
      <div className="h-full bg-black border-r border-white/10 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="text-primary hover:text-primary hover:bg-primary/10"
          title="Expand game list"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Gamepad2 className="h-5 w-5 text-primary mt-4" />
      </div>
    );
  }

  return (
    <div className="h-full bg-black border-r border-white/10 flex flex-col">
      {/* Header */}
      <div className="flex flex-col border-b border-white/10 flex-shrink-0">
          <div className="flex items-center h-16 justify-between px-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Gamepad2 className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="overflow-hidden flex-1">
                <h2 className="font-tech text-[10px] font-bold text-white whitespace-nowrap">
                  SELECT GAME
                </h2>
                <p className="text-[9px] text-muted-foreground whitespace-nowrap">
                  {manuals.length} available
                </p>
              </div>
            </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 flex-shrink-0"
            title="Collapse game list"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-3 pb-3">
          <GameRequestDialog
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-primary hover:text-primary/80 hover:bg-primary/10 border-primary/30 gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Request New Game</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* Game List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-[10px]">
              Loading games...
            </div>
          ) : manuals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-[10px]">
              No games available
            </div>
          ) : (
            manuals.map((manual) => (
              <button
                key={manual.manual_id}
                onClick={() => handleGameSelect(manual)}
                className={cn(
                  "w-full text-left p-2 rounded-md transition-all duration-200 group",
                  "hover:bg-white/5 border border-transparent hover:border-white/10",
                  selectedManualId === manual.manual_id
                    ? "bg-primary/10 border-primary/30"
                    : "bg-white/[0.02]"
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-[10px] font-medium truncate transition-colors",
                      selectedManualId === manual.manual_id
                        ? "text-primary"
                        : "text-foreground group-hover:text-primary"
                    )}>
                      {manual.title || manual.source_filename}
                    </p>
                    {selectedManualId === manual.manual_id && (
                      <Badge className="mt-1 bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0">
                        Active
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 flex-shrink-0 transition-all",
                    selectedManualId === manual.manual_id
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5"
                  )} />
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
