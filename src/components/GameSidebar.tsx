import { useState, useEffect } from 'react';
import { Gamepad2, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

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
}

export function GameSidebar({ selectedManualId, onManualChange }: GameSidebarProps) {
  const navigate = useNavigate();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <div
      className={cn(
        "fixed left-0 top-14 h-[calc(100vh-3.5rem)] bg-black/60 border-r border-white/10 transition-all duration-300 z-40 backdrop-blur-md",
        isExpanded ? "w-80 opacity-100" : "w-14 opacity-0 hover:opacity-100"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Collapsed Icon State */}
      <div className={cn(
        "flex items-center h-16 border-b border-white/10",
        isExpanded ? "justify-between px-4" : "justify-center"
      )}>
        <div className="flex items-center gap-3 relative">
          {!isExpanded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute h-10 w-10 rounded-full bg-orange/20 animate-pulse blur-md" />
            </div>
          )}
          <Gamepad2 className={cn(
            "text-orange transition-all relative z-10",
            isExpanded ? "h-6 w-6" : "h-7 w-7",
            !isExpanded && "drop-shadow-[0_0_8px_rgba(255,106,0,0.6)]"
          )} />
          {isExpanded && (
            <div className="overflow-hidden">
              <h2 className="font-tech text-sm font-bold text-white whitespace-nowrap">
                SELECT GAME
              </h2>
              <p className="text-xs text-cyan/60 whitespace-nowrap">
                {manuals.length} available
              </p>
            </div>
          )}
        </div>
        {isExpanded && (
          <Button
            onClick={() => navigate('/add-games')}
            size="icon"
            className="h-8 w-8 bg-orange hover:bg-orange/80 text-white flex-shrink-0"
            title="Request new game"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Expanded Game List */}
      {isExpanded && (
        <ScrollArea className="h-[calc(100%-4rem)]">
          <div className="p-3 space-y-1">
            {loading ? (
              <div className="text-center py-8 text-cyan/60 text-sm">
                Loading games...
              </div>
            ) : manuals.length === 0 ? (
              <div className="text-center py-8 text-cyan/60 text-sm">
                No games available
              </div>
            ) : (
              manuals.map((manual) => (
                <button
                  key={manual.manual_id}
                  onClick={() => handleGameSelect(manual)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-all duration-200 group",
                    "hover:bg-white/10 border border-transparent hover:border-orange/30",
                    selectedManualId === manual.manual_id
                      ? "bg-orange/20 border-orange/50"
                      : "bg-white/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate transition-colors",
                        selectedManualId === manual.manual_id
                          ? "text-orange"
                          : "text-white group-hover:text-orange"
                      )}>
                        {manual.title || manual.source_filename}
                      </p>
                      {selectedManualId === manual.manual_id && (
                        <Badge className="mt-1 bg-orange/20 text-orange border-orange/30 text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className={cn(
                      "h-4 w-4 flex-shrink-0 transition-all",
                      selectedManualId === manual.manual_id
                        ? "text-orange"
                        : "text-cyan/40 group-hover:text-cyan group-hover:translate-x-0.5"
                    )} />
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      )}

      {/* Hover hint when collapsed */}
      {!isExpanded && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-orange text-white text-xs font-tech rounded-md opacity-0 hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          HOVER TO SELECT GAME
        </div>
      )}
    </div>
  );
}
