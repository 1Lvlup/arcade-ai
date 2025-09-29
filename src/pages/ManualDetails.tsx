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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {document?.title || 'Manual Details'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div><strong>Manual ID:</strong> {document?.manual_id}</div>
                <div><strong>Text Chunks:</strong> {chunks?.length || 0}</div>
              </div>
              
              {chunks && chunks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Processed Chunks:</h3>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {chunks.map((chunk, index) => (
                      <div key={chunk.id} className="p-3 border rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground mb-1">
                          Chunk {index + 1} {chunk.page_start && `(Page ${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''})`}
                        </div>
                        <div className="text-sm line-clamp-3">{chunk.content.substring(0, 200)}...</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <SimpleChat />
        </div>
      </main>
    </div>
  );
}