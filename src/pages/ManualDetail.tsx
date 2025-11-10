import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Database, Image, MessageCircle, Brain, Activity, RefreshCw, Sparkles, Eye, Download, Zap } from 'lucide-react';
import { SharedHeader } from '@/components/SharedHeader';
import { ManualQuestions } from '@/components/ManualQuestions';
import { ManualImages } from '@/components/ManualImages';
import { ManualChunks } from '@/components/ManualChunks';
import { QualityEvaluation } from '@/components/QualityEvaluation';
import { ProcessingMonitor } from '@/components/ProcessingMonitor';
import { OCRDebugPanel } from '@/components/OCRDebugPanel';

interface Manual {
  id: string;
  manual_id: string;
  title: string;
  source_filename: string;
  created_at: string;
  updated_at: string;
  job_id?: string;
}

interface ProcessingStatus {
  id: string;
  status: string;
  stage: string;
  current_task: string;
  progress_percent: number;
  chunks_processed: number;
  total_chunks: number;
  figures_processed: number;
  total_figures: number;
  error_message?: string;
}

interface ManualStats {
  chunks: number;
  figures: number;
  questions: number;
  figuresWithCaptions: number;
  figuresWithoutCaptions: number;
}

export function ManualDetail() {
  const { manualId } = useParams<{ manualId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [manual, setManual] = useState<Manual | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [stats, setStats] = useState<ManualStats>({ 
    chunks: 0, 
    figures: 0, 
    questions: 0,
    figuresWithCaptions: 0,
    figuresWithoutCaptions: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [processingCaptions, setProcessingCaptions] = useState(false);
  const [captionProgress, setCaptionProgress] = useState<{ current: number; total: number } | null>(null);
  const [retryingOCR, setRetryingOCR] = useState(false);

  useEffect(() => {
    if (manualId) {
      fetchManualDetails();
      fetchProcessingStatus();
      fetchStats();
      
      // Set up real-time subscription for processing status updates
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
            if (payload.new) {
              setProcessingStatus(payload.new as ProcessingStatus);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [manualId]);

  const fetchManualDetails = async () => {
    if (!manualId) return;
    
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('manual_id', manualId)
        .single();

      if (error) throw error;
      setManual(data);
    } catch (error) {
      console.error('Error fetching manual details:', error);
      toast({
        title: 'Error loading manual',
        description: 'Failed to load manual details',
        variant: 'destructive',
      });
    }
  };

  const fetchProcessingStatus = async () => {
    if (!manualId) return;
    
    try {
      const { data, error } = await supabase
        .from('processing_status')
        .select('*')
        .eq('manual_id', manualId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setProcessingStatus(data);
      }
    } catch (error) {
      console.error('Error fetching processing status:', error);
    }
  };

  const fetchStats = async () => {
    if (!manualId) return;
    
    try {
      // Fetch chunks - get actual data to count (RLS might be blocking count-only queries)
      const { data: chunksData, error: chunksError, count: chunksCountExact } = await supabase
        .from('chunks_text')
        .select('id', { count: 'exact' })
        .eq('manual_id', manualId);

      console.log('Chunks query result:', { 
        dataLength: chunksData?.length, 
        countExact: chunksCountExact, 
        error: chunksError 
      });

      const chunksCount = chunksCountExact || chunksData?.length || 0;

      // Fetch figures count and caption stats
      const { data: figuresData, error: figuresError, count: figuresCountExact } = await supabase
        .from('figures')
        .select('id, caption_text', { count: 'exact' })
        .eq('manual_id', manualId);

      const figuresCount = figuresCountExact || figuresData?.length || 0;
      const figuresWithCaptions = figuresData?.filter(f => f.caption_text).length || 0;
      const figuresWithoutCaptions = figuresCount - figuresWithCaptions;

      if (figuresError) {
        console.error('Error fetching figures:', figuresError);
      }

      // Fetch questions count from golden_questions
      const { data: questionsData, error: questionsError, count: questionsCountExact } = await supabase
        .from('golden_questions')
        .select('id', { count: 'exact' })
        .eq('manual_id', manualId);

      const questionsCount = questionsCountExact || questionsData?.length || 0;

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
      }

      console.log('Final stats:', { chunksCount, figuresCount, questionsCount, figuresWithCaptions, figuresWithoutCaptions });

      setStats({
        chunks: chunksCount,
        figures: figuresCount,
        questions: questionsCount,
        figuresWithCaptions,
        figuresWithoutCaptions
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateGoldenQuestions = async () => {
    if (!manualId) return;
    
    setGeneratingQuestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-golden-questions', {
        body: { manual_id: manualId }
      });

      if (error) throw error;

      toast({
        title: 'Golden questions generated',
        description: `Generated ${data.questions?.length || 0} questions for this manual`,
      });
      
      fetchStats(); // Refresh stats to show new questions count
      setActiveTab('questions'); // Switch to questions tab
    } catch (error) {
      console.error('Error generating questions:', error);
      toast({
        title: 'Error generating questions',
        description: 'Failed to generate golden questions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const retryOCRProcessing = async () => {
    if (!manualId) return;
    
    setRetryingOCR(true);
    try {
      const { data, error } = await supabase.functions.invoke('retry-processing', {
        body: { manual_id: manualId }
      });

      if (error) throw error;

      toast({
        title: 'OCR Processing Started',
        description: `Processing ${data.pending_figures || stats.figures} figures. This may take several minutes.`,
      });
      
      // Refresh processing status
      fetchProcessingStatus();
      
      // Poll for completion
      const pollInterval = setInterval(() => {
        fetchStats();
        fetchProcessingStatus();
      }, 5000);
      
      // Clear polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);
    } catch (error) {
      console.error('Error retrying OCR:', error);
      toast({
        title: 'OCR Retry Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRetryingOCR(false);
    }
  };

  const processCaptions = async () => {
    if (!manualId) return;
    
    setProcessingCaptions(true);
    
    // Set initial progress
    setCaptionProgress({
      current: stats.figuresWithCaptions,
      total: stats.figures
    });

    // Start polling for progress
    const pollInterval = setInterval(async () => {
      const { data: figuresData } = await supabase
        .from('figures')
        .select('id, caption_text', { count: 'exact' })
        .eq('manual_id', manualId);

      const figuresWithCaptions = figuresData?.filter(f => f.caption_text).length || 0;
      
      setCaptionProgress({
        current: figuresWithCaptions,
        total: stats.figures
      });
    }, 3000); // Poll every 3 seconds

    try {
      const { data, error } = await supabase.functions.invoke('process-figure-captions', {
        body: { manual_id: manualId }
      });

      clearInterval(pollInterval);

      if (error) throw error;

      toast({
        title: 'Caption Processing Complete',
        description: `Generated captions for ${data.processed} of ${data.total} figures.`,
      });

      fetchStats();
    } catch (error) {
      clearInterval(pollInterval);
      console.error('Error processing captions:', error);
      toast({
        title: 'Caption Processing Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setProcessingCaptions(false);
      setCaptionProgress(null);
    }
  };



  const getStatusColor = () => {
    if (!processingStatus) return 'bg-muted';
    
    switch (processingStatus.status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-primary';
      case 'failed': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const getStatusText = () => {
    if (!processingStatus) return 'Unknown';
    
    if (processingStatus.status === 'completed') {
      return 'Processing Complete';
    } else if (processingStatus.status === 'processing') {
      return processingStatus.current_task || 'Processing...';
    } else if (processingStatus.status === 'failed') {
      return 'Processing Failed';
    }
    return processingStatus.status;
  };

  if (loading) {
    return (
      <div className="min-h-screen mesh-gradient">
        <SharedHeader title="Loading Manual..." showBackButton={true} backTo="/manuals" />
        <main className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            <span className="ml-4 text-xl text-foreground">Loading manual details...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!manual) {
    return (
      <div className="min-h-screen mesh-gradient">
        <SharedHeader title="Manual Not Found" showBackButton={true} backTo="/manuals" />
        <main className="container mx-auto px-6 py-8">
          <Card className="border-destructive bg-card">
            <CardContent className="text-center py-12">
              <h2 className="text-2xl font-bold text-destructive mb-4">Manual Not Found</h2>
              <p className="text-muted-foreground">The requested manual could not be found.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader 
        title={manual.title} 
        showBackButton={true} 
        backTo="/manuals"
      />
      
      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Header Card */}
        <Card className="border-primary/30 bg-card shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-bold flex items-center space-x-3">
                  <Database className="h-8 w-8" />
                  <span>{manual.title}</span>
                </CardTitle>
                <CardDescription className="text-primary-foreground/80 text-xl mt-2">
                  {manual.source_filename}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-primary-foreground/80 text-sm">Manual ID</div>
                <div className="font-mono text-sm">{manual.manual_id}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Processing Monitor with Resume Button */}
            {manual.job_id && (
              <div className="mb-6">
                <ProcessingMonitor 
                  job_id={manual.job_id} 
                  manual_id={manual.manual_id}
                  onComplete={() => {
                    fetchStats();
                    fetchProcessingStatus();
                  }}
                />
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card border border-primary/30 rounded-lg p-6 text-center">
                <Database className="h-12 w-12 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-foreground">{stats.chunks}</div>
                <div className="text-muted-foreground font-medium text-lg">Text Chunks</div>
              </div>
              <div className="bg-card border border-green-500/30 rounded-lg p-6 text-center">
                <Image className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <div className="text-3xl font-bold text-foreground">{stats.figures}</div>
                <div className="text-muted-foreground font-medium text-lg">Images</div>
              </div>
              <div className="bg-card border border-purple-500/30 rounded-lg p-6 text-center">
                <Brain className="h-12 w-12 text-purple-500 mx-auto mb-3" />
                <div className="text-3xl font-bold text-foreground">{stats.questions}</div>
                <div className="text-muted-foreground font-medium text-lg">Golden Questions</div>
              </div>
            </div>

            {/* Caption Progress */}
            {captionProgress && (
              <div className="mb-4 p-4 bg-card border border-primary/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Generating Captions: {captionProgress.current} / {captionProgress.total}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((captionProgress.current / captionProgress.total) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={(captionProgress.current / captionProgress.total) * 100} 
                  className="h-2"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 mt-6">
              {processingStatus?.status === 'processing' && processingStatus.progress_percent > 90 && processingStatus.progress_percent < 100 && (
                <Button 
                  onClick={retryOCRProcessing}
                  disabled={retryingOCR}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                >
                  {retryingOCR ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Restart OCR Processing
                </Button>
              )}
              {stats.figuresWithoutCaptions > 0 && (
                <Button 
                  onClick={processCaptions}
                  disabled={processingCaptions}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                >
                  {processingCaptions ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Captions & OCR ({stats.figuresWithoutCaptions} images)
                </Button>
              )}
              {stats.figuresWithCaptions > 0 && (
                <Button 
                  onClick={async () => {
                    if (!window.confirm(`This will regenerate captions for ALL ${stats.figures} images. This is useful after improving the caption prompts. Continue?`)) {
                      return;
                    }
                    
                    // Clear existing captions first
                    setProcessingCaptions(true);
                    try {
                      const { error: clearError } = await supabase
                        .from('figures')
                        .update({ caption_text: null, ocr_text: null })
                        .eq('manual_id', manualId);
                      
                      if (clearError) throw clearError;
                      
                      // Refresh stats to show uncaptioned count
                      await fetchStats();
                      
                      toast({
                        title: 'Captions cleared',
                        description: 'Starting regeneration process...',
                      });
                      
                      // Then process captions
                      await processCaptions();
                    } catch (error) {
                      console.error('Error clearing captions:', error);
                      toast({
                        title: 'Error',
                        description: 'Failed to clear existing captions',
                        variant: 'destructive',
                      });
                      setProcessingCaptions(false);
                    }
                  }}
                  disabled={processingCaptions}
                  variant="outline"
                  className="border-orange-500 text-orange-600 hover:bg-orange-500/10"
                >
                  {processingCaptions ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate All Captions ({stats.figures} images)
                </Button>
              )}
              <Button 
                onClick={generateGoldenQuestions}
                disabled={generatingQuestions || processingStatus?.status !== 'completed'}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
              >
                {generatingQuestions ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Golden Questions
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  const searchParams = new URLSearchParams({
                    manual_id: manual.manual_id,
                    title: manual.title || manual.source_filename
                  });
                  window.open(`/?chat=true&${searchParams.toString()}`, '_blank');
                }}
                disabled={processingStatus?.status !== 'completed'}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat with Manual
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-card border border-primary/30">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Overview
            </TabsTrigger>
            <TabsTrigger value="questions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Questions
            </TabsTrigger>
            <TabsTrigger value="evaluation" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              RAG Quality
            </TabsTrigger>
            <TabsTrigger value="images" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Images
            </TabsTrigger>
            <TabsTrigger value="chunks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Text Chunks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="border-primary/30 bg-card">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground">Manual Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-xl mb-3 text-foreground">Document Information</h3>
                    <div className="space-y-2 text-muted-foreground text-base">
                      <div><span className="font-medium text-foreground">Title:</span> {manual.title}</div>
                      <div><span className="font-medium text-foreground">Filename:</span> {manual.source_filename}</div>
                      <div><span className="font-medium text-foreground">Created:</span> {new Date(manual.created_at).toLocaleString()}</div>
                      <div><span className="font-medium text-foreground">Updated:</span> {new Date(manual.updated_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl mb-3 text-foreground">Processing Details</h3>
                    <div className="space-y-2 text-muted-foreground text-base">
                      <div><span className="font-medium text-foreground">Job ID:</span> {manual.job_id || 'N/A'}</div>
                      <div><span className="font-medium text-foreground">Status:</span> {processingStatus?.status || 'Unknown'}</div>
                      <div><span className="font-medium text-foreground">Stage:</span> {processingStatus?.stage || 'N/A'}</div>
                      {processingStatus?.error_message && (
                        <div className="text-destructive">
                          <span className="font-medium">Error:</span> {processingStatus.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions">
            {activeTab === 'questions' && <ManualQuestions manualId={manualId!} />}
          </TabsContent>

          <TabsContent value="evaluation">
            {activeTab === 'evaluation' && <QualityEvaluation manualId={manualId!} />}
          </TabsContent>

          <TabsContent value="images" className="space-y-6">
            {activeTab === 'images' && (
              <>
                <OCRDebugPanel manualId={manualId!} />
                <ManualImages manualId={manualId!} />
              </>
            )}
          </TabsContent>

          <TabsContent value="chunks">
            {activeTab === 'chunks' && <ManualChunks manualId={manualId!} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}