import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { SharedHeader } from '@/components/SharedHeader';
import { SimpleChat } from '@/components/SimpleChat';
import { ManualImages } from '@/components/ManualImages';
import { ManualQuestions } from '@/components/ManualQuestions';
import { FileText, Image as ImageIcon, Brain, Scan, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

export default function ManualDetails() {
  const { manualId } = useParams<{ manualId: string }>();
  const queryClient = useQueryClient();
  const [processingStatus, setProcessingStatus] = useState<any>(null);

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

  const { data: figures } = useQuery({
    queryKey: ['figures', manualId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('figures')
        .select('*')
        .eq('manual_id', manualId)
        .order('page_number', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!manualId,
  });

  const processOcrMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-figure-ocr', {
        body: { manual_id: manualId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['figures', manualId] });
      toast.success(`✅ OCR processed: ${data.processed}/${data.total} figures updated`);
    },
    onError: (error: Error) => {
      toast.error(`❌ OCR processing failed: ${error.message}`);
    }
  });

  const processCaptionsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-figure-captions', {
        body: { manual_id: manualId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['figures', manualId] });
      toast.success(`✅ Captions processed: ${data.processed}/${data.total} figures updated`);
    },
    onError: (error: Error) => {
      toast.error(`❌ Caption processing failed: ${error.message}`);
    }
  });

  const [backfillProgress, setBackfillProgress] = useState<{
    type: 'metadata' | 'figures' | null;
    current: number;
    total: number;
    isRunning: boolean;
  }>({ type: null, current: 0, total: 0, isRunning: false });

  const figuresWithoutOcr = figures?.filter(f => !f.ocr_text).length || 0;
  const figuresWithOcr = figures?.filter(f => f.ocr_text).length || 0;
  const figuresWithoutCaptions = figures?.filter(f => !f.caption_text).length || 0;
  const figuresWithCaptions = figures?.filter(f => f.caption_text).length || 0;
  const figuresWithoutType = figures?.filter(f => !f.figure_type).length || 0;

  // Query processing status
  const { data: statusData } = useQuery({
    queryKey: ['processing_status', manualId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processing_status')
        .select('*')
        .eq('manual_id', manualId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!manualId,
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!manualId) return;

    const channel = supabase
      .channel(`processing-status-${manualId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processing_status',
          filter: `manual_id=eq.${manualId}`
        },
        (payload) => {
          console.log('Processing status update:', payload);
          setProcessingStatus(payload.new);
          queryClient.invalidateQueries({ queryKey: ['processing_status', manualId] });
          queryClient.invalidateQueries({ queryKey: ['figures', manualId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [manualId, queryClient]);

  useEffect(() => {
    if (statusData) {
      setProcessingStatus(statusData);
    }
  }, [statusData]);

  const isProcessing = processingStatus?.stage === 'caption_generation' && 
                       processingStatus?.status === 'processing';

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Manual Analysis" showBackButton={true} backTo="/manuals" />
      
      {/* Action Bar */}
      <div className="nav-tech border-b border-primary/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-tech-lg text-primary">Technical Documentation</h2>
              <div className="w-px h-6 bg-primary/30"></div>
              <span className="font-mono text-sm text-muted-foreground">
                ID: {document?.manual_id?.split('-').pop()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/manuals">
                <Button className="btn-tech-outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Browse Manuals
                </Button>
              </Link>
              <Link to="/manuals/upload">
                <Button className="btn-tech">
                  Upload New Manual
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Status Overview */}
          <div className="tech-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-tech-xl text-primary text-glow">
                    {document?.title || 'Manual Analysis'}
                  </h1>
                  <p className="font-mono text-sm text-muted-foreground mt-1">
                    Source: {document?.source_filename}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span className="font-mono text-sm text-primary">ANALYZED</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="tech-card p-4 bg-gradient-tech">
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Manual ID</div>
                <div className="font-mono text-sm text-primary mt-1 break-all">{document?.manual_id}</div>
              </div>
              <div className="tech-card p-4 bg-gradient-tech">
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Content Chunks</div>
                <div className="text-tech-base text-primary mt-1">{chunks?.length || 0}</div>
              </div>
              <div className="tech-card p-4 bg-gradient-tech">
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Figures Extracted</div>
                <div className="text-tech-base text-primary mt-1">{figures?.length || 0}</div>
              </div>
              <div className="tech-card p-4 bg-gradient-tech">
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">OCR Status</div>
                <div className="text-sm mt-1">
                  <span className="text-primary">{figuresWithOcr}</span>
                  <span className="text-muted-foreground"> / {figures?.length || 0}</span>
                </div>
              </div>
            </div>
            
            {/* Live Processing Progress */}
            {isProcessing && (
              <div className="mt-4 p-4 border border-primary/30 rounded-lg bg-primary/5 animate-pulse-subtle">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  <div>
                    <h3 className="font-mono text-sm text-primary font-semibold">
                      🔄 Caption & OCR Processing In Progress
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {processingStatus.current_task}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress value={processingStatus.progress_percent} className="h-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {processingStatus.figures_processed} / {processingStatus.total_figures} figures
                    </span>
                    <span className="text-primary font-mono">
                      {processingStatus.progress_percent}%
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Caption Processing Button */}
            {figuresWithoutCaptions > 0 && (
              <div className="mt-4 p-4 border border-blue-500/20 rounded-lg bg-blue-500/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-mono text-sm text-blue-400 mb-1">
                      🎨 Caption Generation Available
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {figuresWithoutCaptions} figures need AI-generated captions. This will enable image search.
                    </p>
                  </div>
                  <Button
                    onClick={() => processCaptionsMutation.mutate()}
                    disabled={processCaptionsMutation.isPending}
                    className="btn-tech"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    {processCaptionsMutation.isPending ? 'Processing...' : 'Generate Captions'}
                  </Button>
                </div>
              </div>
            )}
            
            {/* OCR Processing Button */}
            {figuresWithoutOcr > 0 && (
              <div className="mt-4 p-4 border border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-mono text-sm text-primary mb-1">
                      🔍 OCR Processing Available
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {figuresWithoutOcr} figures need OCR text extraction. This will improve search accuracy.
                    </p>
                  </div>
                  <Button
                    onClick={() => processOcrMutation.mutate()}
                    disabled={processOcrMutation.isPending}
                    className="btn-tech"
                  >
                    <Scan className="h-4 w-4 mr-2" />
                    {processOcrMutation.isPending ? 'Processing...' : 'Process OCR'}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Metadata Backfill Button */}
            <div className="mt-4 p-4 border border-purple-500/20 rounded-lg bg-purple-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-sm text-purple-400 mb-1">
                    📦 Populate Chunk Metadata
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Update all text chunks with game title, platform, manufacturer, and other metadata from manual_metadata table.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      setBackfillProgress({ type: 'metadata', current: 0, total: chunks?.length || 0, isRunning: true });
                      const { data, error } = await supabase.rpc('fn_backfill_for_manual_any', {
                        p_manual_id: manualId
                      });
                      
                      if (error) throw error;
                      
                      setBackfillProgress({ type: null, current: 0, total: 0, isRunning: false });
                      const result = data as any;
                      toast.success(`✅ Metadata backfill complete`, {
                        description: `Updated ${result.total} records (${result.updated_chunks_text} chunks, ${result.updated_rag_chunks} rag_chunks)`
                      });
                      queryClient.invalidateQueries({ queryKey: ['chunks', manualId] });
                    } catch (error: any) {
                      setBackfillProgress({ type: null, current: 0, total: 0, isRunning: false });
                      toast.error('❌ Metadata backfill failed', {
                        description: error.message
                      });
                    }
                  }}
                  disabled={backfillProgress.isRunning && backfillProgress.type === 'metadata'}
                  className="btn-tech"
                >
                  {backfillProgress.isRunning && backfillProgress.type === 'metadata' ? 'Processing...' : 'Populate Metadata'}
                </Button>
              </div>
              {backfillProgress.isRunning && backfillProgress.type === 'metadata' && (
                <div className="mt-3 space-y-2">
                  <Progress value={100} className="h-2" />
                  <p className="text-xs text-muted-foreground">Processing {backfillProgress.total} chunks...</p>
                </div>
              )}
            </div>
            
            {/* Figure Type Backfill Button */}
            {figuresWithoutType > 0 && (
              <div className="mt-4 p-4 border border-orange-500/20 rounded-lg bg-orange-500/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-mono text-sm text-orange-400 mb-1">
                      🏷️ Classify Figure Types
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {figuresWithoutType} figures need type classification (diagram, photo, schematic, etc.). This enables better filtering.
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      try {
                        setBackfillProgress({ type: 'figures', current: 0, total: figuresWithoutType, isRunning: true });
                        toast.loading(`Processing ${figuresWithoutType} figures...`, { id: 'figure-backfill' });
                        
                        const { data, error } = await supabase.functions.invoke('backfill-figure-types', {
                          body: { manual_id: manualId }
                        });
                        
                        if (error) throw error;
                        
                        setBackfillProgress({ type: null, current: 0, total: 0, isRunning: false });
                        toast.dismiss('figure-backfill');
                        toast.success(`✅ Classified ${data.processed}/${data.total} figures`, {
                          description: data.errors ? `${data.errors} errors occurred` : 'All figures updated'
                        });
                        queryClient.invalidateQueries({ queryKey: ['figures', manualId] });
                      } catch (error: any) {
                        setBackfillProgress({ type: null, current: 0, total: 0, isRunning: false });
                        toast.dismiss('figure-backfill');
                        toast.error('❌ Figure classification failed', {
                          description: error.message
                        });
                      }
                    }}
                    disabled={backfillProgress.isRunning && backfillProgress.type === 'figures'}
                    className="btn-tech"
                  >
                    {backfillProgress.isRunning && backfillProgress.type === 'figures' ? 'Processing...' : 'Classify Figures'}
                  </Button>
                </div>
                {backfillProgress.isRunning && backfillProgress.type === 'figures' && (
                  <div className="mt-3 space-y-2">
                    <Progress value={(backfillProgress.current / backfillProgress.total) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Processing {backfillProgress.current} / {backfillProgress.total} figures...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tabbed Content */}
          <Tabs defaultValue="chunks" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="chunks" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Content Chunks
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Figures ({figures?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="questions" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Golden Questions
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                🤖 AI Assistant
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="chunks">
              {/* Content Analysis */}
              {chunks && chunks.length > 0 && (
                <div className="tech-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-tech-lg text-primary flex items-center gap-3">
                      <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                      Content Analysis Results
                    </h2>
                    <div className="font-mono text-sm text-muted-foreground">
                      {chunks.length} segments processed
                    </div>
                  </div>
                  
                  <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {chunks.map((chunk, index) => (
                      <div key={chunk.id} className="tech-card p-5 hover:border-primary/40 transition-all duration-300 group">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                              <span className="font-mono text-xs text-primary font-bold">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                            </div>
                            <div className="font-mono text-xs text-primary uppercase tracking-wider">
                              Segment {index + 1}
                            </div>
                          </div>
                          {chunk.page_start && (
                            <div className="px-3 py-1 rounded-full bg-secondary/30 border border-primary/20">
                              <span className="font-mono text-xs text-muted-foreground">
                                Page {chunk.page_start}{chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="bg-background/50 rounded-lg p-4 border border-primary/10">
                          <div className="text-sm text-foreground/90 leading-relaxed font-body">
                            {chunk.content.length > 400 ? 
                              `${chunk.content.substring(0, 400)}...` : 
                              chunk.content
                            }
                          </div>
                        </div>
                        
                        {chunk.menu_path && (
                          <div className="mt-3 flex items-center gap-2">
                            <div className="w-4 h-px bg-primary/30"></div>
                            <span className="font-mono text-xs text-primary/70">
                              {chunk.menu_path}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="images">
              {manualId && <ManualImages manualId={manualId} />}
            </TabsContent>

            <TabsContent value="questions">
              {manualId && <ManualQuestions manualId={manualId} />}
            </TabsContent>

            <TabsContent value="chat">
              {/* AI Chat Interface */}
              <div className="tech-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="w-6 h-6 text-primary">🤖</div>
                  </div>
                  <div>
                    <h2 className="text-tech-lg text-primary text-glow">
                      AI Technical Assistant
                    </h2>
                    <p className="font-mono text-sm text-muted-foreground">
                      Ask questions about troubleshooting, repairs, or technical specifications
                    </p>
                  </div>
                </div>
                <div className="border-t border-primary/10 pt-6">
                  <SimpleChat manualId={manualId} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}