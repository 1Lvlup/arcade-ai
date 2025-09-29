import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SharedHeader } from '@/components/SharedHeader';
import { SimpleChat } from '@/components/SimpleChat';
import { FileText } from 'lucide-react';

export default function ManualDetails() {
  const { manualId } = useParams<{ manualId: string }>();

  const { data: document } = useQuery({
    queryKey: ['document', manualId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('manual_id', manualId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!manualId,
  });

  const { data: chunks } = useQuery({
    queryKey: ['chunks', manualId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chunks_text')
        .select('*')
        .eq('manual_id', manualId)
        .order('page_start', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!manualId,
  });

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Manual Details" />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header Card with Glow */}
          <Card className="border-glow shadow-orange">
            <CardHeader className="bg-gradient-to-r from-secondary/20 to-primary/10 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-glow">
                <FileText className="h-6 w-6 text-primary" />
                {document?.title || 'Manual Details'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted/50 border border-primary/20">
                  <div className="text-sm text-muted-foreground">Manual ID</div>
                  <div className="font-mono text-sm text-primary">{document?.manual_id}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border border-primary/20">
                  <div className="text-sm text-muted-foreground">Text Chunks</div>
                  <div className="text-2xl font-bold text-primary">{chunks?.length || 0}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border border-primary/20">
                  <div className="text-sm text-muted-foreground">Source File</div>
                  <div className="text-sm text-foreground truncate">{document?.source_filename}</div>
                </div>
              </div>
              
              {chunks && chunks.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    Processed Content Chunks
                  </h3>
                  <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                    {chunks.map((chunk, index) => (
                      <div key={chunk.id} className="p-4 border border-primary/30 rounded-lg bg-gradient-to-r from-background to-muted/30 hover:border-primary/50 transition-all duration-300 glow-orange hover:shadow-orange-strong">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-primary font-medium">
                            Chunk #{index + 1}
                          </div>
                          {chunk.page_start && (
                            <div className="text-xs text-muted-foreground bg-secondary/30 px-2 py-1 rounded">
                              Page {chunk.page_start}{chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-foreground/90 leading-relaxed">
                          {chunk.content.length > 300 ? 
                            `${chunk.content.substring(0, 300)}...` : 
                            chunk.content
                          }
                        </div>
                        {chunk.menu_path && (
                          <div className="mt-2 text-xs text-orange-400 font-mono">
                            📍 {chunk.menu_path}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Interface */}
          <Card className="border-glow shadow-orange">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/20 rounded-t-lg">
              <CardTitle className="text-primary text-glow">Ask Questions About This Manual</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SimpleChat />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}