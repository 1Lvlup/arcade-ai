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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Manual ID:</strong> {document?.manual_id}</div>
                <div><strong>Text Chunks:</strong> {chunks?.length || 0}</div>
              </div>
            </CardContent>
          </Card>

          <SimpleChat />
        </div>
      </main>
    </div>
  );
}