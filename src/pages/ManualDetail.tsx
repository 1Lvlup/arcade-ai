import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Database, Image, MessageCircle, Brain, Activity, RefreshCw, Sparkles, Eye, Download } from 'lucide-react';
import { SharedHeader } from '@/components/SharedHeader';
import { ManualQuestions } from '@/components/ManualQuestions';
import { ManualImages } from '@/components/ManualImages';
import { ManualChunks } from '@/components/ManualChunks';

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
}

export function ManualDetail() {
  const { manualId } = useParams<{ manualId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [manual, setManual] = useState<Manual | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [stats, setStats] = useState<ManualStats>({ chunks: 0, figures: 0, questions: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

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
      // Fetch chunks count
      const { count: chunksCount } = await supabase
        .from('chunks_text')
        .select('*', { count: 'exact', head: true })
        .eq('manual_id', manualId);

      // Fetch figures count
      const { count: figuresCount } = await supabase
        .from('figures')
        .select('*', { count: 'exact', head: true })
        .eq('manual_id', manualId);

      // TODO: Fetch questions count when implemented
      const questionsCount = 0;

      setStats({
        chunks: chunksCount || 0,
        figures: figuresCount || 0,
        questions: questionsCount
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
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
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
    <div className="min-h-screen bg-background">
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
                <CardDescription className="text-primary-foreground/80 text-lg mt-2">
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
            {/* Processing Status */}
            {processingStatus && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${getStatusColor()}`}></div>
                    <span className="font-semibold text-lg">{getStatusText()}</span>
                  </div>
                  <Badge variant={processingStatus.status === 'completed' ? 'default' : 'secondary'}>
                    {processingStatus.progress_percent}% Complete
                  </Badge>
                </div>
                <Progress value={processingStatus.progress_percent} className="h-3" />
                {processingStatus.status === 'processing' && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {processingStatus.chunks_processed} / {processingStatus.total_chunks} chunks processed
                  </div>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 text-center">
                <Database className="h-12 w-12 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-foreground">{stats.chunks}</div>
                <div className="text-muted-foreground font-medium">Text Chunks</div>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
                <Image className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <div className="text-3xl font-bold text-foreground">{stats.figures}</div>
                <div className="text-muted-foreground font-medium">Images</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6 text-center">
                <Brain className="h-12 w-12 text-purple-500 mx-auto mb-3" />
                <div className="text-3xl font-bold text-foreground">{stats.questions}</div>
                <div className="text-muted-foreground font-medium">Golden Questions</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 mt-6">
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
          <TabsList className="grid w-full grid-cols-4 bg-card border border-primary/30">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Overview
            </TabsTrigger>
            <TabsTrigger value="questions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Golden Questions
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
                    <h3 className="font-semibold text-lg mb-3 text-foreground">Document Information</h3>
                    <div className="space-y-2 text-muted-foreground">
                      <div><span className="font-medium text-foreground">Title:</span> {manual.title}</div>
                      <div><span className="font-medium text-foreground">Filename:</span> {manual.source_filename}</div>
                      <div><span className="font-medium text-foreground">Created:</span> {new Date(manual.created_at).toLocaleString()}</div>
                      <div><span className="font-medium text-foreground">Updated:</span> {new Date(manual.updated_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-foreground">Processing Details</h3>
                    <div className="space-y-2 text-muted-foreground">
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
            <ManualQuestions manualId={manualId!} />
          </TabsContent>

          <TabsContent value="images">
            <ManualImages manualId={manualId!} />
          </TabsContent>

          <TabsContent value="chunks">
            <ManualChunks manualId={manualId!} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}