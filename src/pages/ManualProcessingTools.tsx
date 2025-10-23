import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SharedHeader } from '@/components/SharedHeader';
import { ArrowLeft, Database, Image, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export default function ManualProcessingTools() {
  const { manualId } = useParams<{ manualId: string }>();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState<{
    metadata: boolean;
    figureTypes: boolean;
  }>({ metadata: false, figureTypes: false });

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
        .eq('manual_id', manualId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!manualId,
  });

  const { data: figures } = useQuery({
    queryKey: ['figures', manualId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('figures')
        .select('*')
        .eq('manual_id', manualId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!manualId,
  });

  const figuresWithoutType = figures?.filter(f => !f.figure_type).length || 0;

  const handleMetadataBackfill = async () => {
    try {
      setProcessing({ ...processing, metadata: true });
      toast.loading('Processing metadata backfill...', { id: 'metadata-backfill' });
      
      const { data, error } = await supabase.rpc('fn_backfill_for_manual_any', {
        p_manual_id: manualId
      });
      
      if (error) throw error;
      
      const result = data as any;
      toast.dismiss('metadata-backfill');
      toast.success(`✅ Metadata backfill complete`, {
        description: `Updated ${result.total} records (${result.updated_chunks_text} chunks, ${result.updated_rag_chunks} rag_chunks)`
      });
      queryClient.invalidateQueries({ queryKey: ['chunks', manualId] });
    } catch (error: any) {
      toast.dismiss('metadata-backfill');
      toast.error('❌ Metadata backfill failed', {
        description: error.message
      });
    } finally {
      setProcessing({ ...processing, metadata: false });
    }
  };

  const handleFigureTypeBackfill = async () => {
    try {
      setProcessing({ ...processing, figureTypes: true });
      toast.loading(`Processing ${figuresWithoutType} figures...`, { id: 'figure-backfill' });
      
      const { data, error } = await supabase.functions.invoke('backfill-figure-types', {
        body: { manual_id: manualId }
      });
      
      if (error) throw error;
      
      toast.dismiss('figure-backfill');
      toast.success(`✅ Classified ${data.processed}/${data.total} figures`, {
        description: data.errors ? `${data.errors} errors occurred` : 'All figures updated'
      });
      queryClient.invalidateQueries({ queryKey: ['figures', manualId] });
    } catch (error: any) {
      toast.dismiss('figure-backfill');
      toast.error('❌ Figure classification failed', {
        description: error.message
      });
    } finally {
      setProcessing({ ...processing, figureTypes: false });
    }
  };

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Processing Tools" showBackButton={true} backTo={`/manuals/${manualId}`} />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link to={`/manuals/${manualId}`}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Manual
            </Button>
          </Link>
          <h1 className="text-4xl font-bold neon-text mb-2">Processing Tools</h1>
          <p className="text-muted-foreground">{document?.title}</p>
        </div>

        <div className="space-y-6">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Status</CardTitle>
              <CardDescription>Current state of processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Text Chunks</div>
                  <div className="text-2xl font-bold text-primary">{chunks?.length || 0}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Figures</div>
                  <div className="text-2xl font-bold text-primary">{figures?.length || 0}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Missing Types</div>
                  <div className="text-2xl font-bold text-orange-500">{figuresWithoutType}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metadata Backfill */}
          <Card className="border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-purple-500" />
                Populate Chunk Metadata
              </CardTitle>
              <CardDescription>
                Update all text chunks with game title, platform, manufacturer, and other metadata from manual_metadata table
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Ready to process {chunks?.length || 0} chunks</span>
                </div>
                <Button
                  onClick={handleMetadataBackfill}
                  disabled={processing.metadata}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {processing.metadata ? 'Processing...' : 'Run Metadata Backfill'}
                </Button>
              </div>
              {processing.metadata && (
                <div className="space-y-2">
                  <Progress value={100} className="h-2" />
                  <p className="text-xs text-muted-foreground">Processing metadata...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Figure Type Backfill */}
          <Card className="border-orange-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5 text-orange-500" />
                Classify Figure Types
              </CardTitle>
              <CardDescription>
                Extract figure_type metadata (diagram, photo, schematic, etc.) from existing images using Vision AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {figuresWithoutType > 0 ? (
                    <>
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      <span className="text-sm">{figuresWithoutType} figures need classification</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-sm">All figures classified</span>
                    </>
                  )}
                </div>
                <Button
                  onClick={handleFigureTypeBackfill}
                  disabled={processing.figureTypes || figuresWithoutType === 0}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {processing.figureTypes ? 'Processing...' : 
                   figuresWithoutType === 0 ? 'Already Classified' : 'Run Classification'}
                </Button>
              </div>
              {processing.figureTypes && (
                <div className="space-y-2">
                  <Progress value={50} className="h-2" />
                  <p className="text-xs text-muted-foreground">Classifying figures with Vision AI...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
