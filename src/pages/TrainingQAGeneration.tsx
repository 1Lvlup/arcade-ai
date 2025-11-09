import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrainingAuth } from '@/hooks/useTrainingAuth';
import { TrainingLogin } from '@/components/TrainingLogin';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ManualSelector } from '@/components/ManualSelector';
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface QAPair {
  question: string;
  answer: string;
  context?: string;
}

export default function TrainingQAGeneration() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useTrainingAuth();
  const [loading, setLoading] = useState(false);
  const [contentText, setContentText] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [pageStart, setPageStart] = useState('');
  const [pageEnd, setPageEnd] = useState('');
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string>('');

  const loadManualPDF = async (selectedManualId: string) => {
    try {
      // Get the document to find the storage path
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('source_filename, id')
        .eq('manual_id', selectedManualId)
        .single();

      if (docError) {
        console.error('Error finding document:', docError);
        toast.error('Failed to load manual');
        return;
      }

      // Get the user's profile to construct the storage path
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      // List files in the user's directory to find the PDF
      const { data: files, error: listError } = await supabase
        .storage
        .from('manuals')
        .list(user.id);

      if (listError) {
        console.error('Error listing files:', listError);
        toast.error('Failed to load manual files');
        return;
      }

      // Find the matching file (look for the source_filename)
      const matchingFile = files?.find(f => f.name.includes(doc.source_filename.replace('.pdf', '')));
      
      if (!matchingFile) {
        toast.error('PDF file not found in storage');
        return;
      }

      // Get signed URL for the PDF
      const { data: urlData, error: urlError } = await supabase
        .storage
        .from('manuals')
        .createSignedUrl(`${user.id}/${matchingFile.name}`, 3600);

      if (urlError) {
        console.error('Error getting signed URL:', urlError);
        toast.error('Failed to load PDF');
        return;
      }

      // Set the PDF URL for viewing
      setPdfUrl(urlData.signedUrl);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('Failed to load manual');
    }
  };

  const handleManualChange = (selectedManualId: string | null, title: string | null) => {
    if (selectedManualId && title) {
      setManualId(selectedManualId);
      setManualTitle(title);
      loadManualPDF(selectedManualId);
    } else {
      setManualId('');
      setManualTitle('');
      setPdfUrl('');
    }
  };

  const handleGenerate = async () => {
    if (!contentText.trim()) {
      toast.error('Please provide content to generate Q&A from');
      return;
    }

    try {
      setLoading(true);
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        'https://wryxbfnmecjffxolcgfa.supabase.co/functions/v1/training-generate-qa',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`
          },
          body: JSON.stringify({
            content: contentText,
            manual_id: manualId || undefined,
            page_start: pageStart ? parseInt(pageStart) : undefined,
            page_end: pageEnd ? parseInt(pageEnd) : undefined
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate Q&A pairs');
      }

      const data = await response.json();
      setQaPairs(data.qa_pairs || []);
      toast.success(`Generated ${data.count} Q&A pairs`);
    } catch (error) {
      console.error('Error generating Q&A:', error);
      toast.error('Failed to generate Q&A pairs');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-gradient">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <TrainingLogin />;
  }

  return (
    <div className="space-y-6">
      <div className="w-full space-y-4">
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            Select a manual to view it, then copy and paste content from the PDF to generate Q&A pairs.
          </AlertDescription>
        </Alert>

        <ResizablePanelGroup direction="horizontal" className="min-h-[800px] border rounded-lg">
          {/* Left Panel - Manual Viewer */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col p-4 space-y-4">
              <div>
                <Label>Select Manual</Label>
                <ManualSelector 
                  selectedManualId={manualId || null}
                  onManualChange={handleManualChange}
                />
              </div>

              {manualTitle && (
                <Card className="flex-1 flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base">{manualTitle}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden">
                    {!pdfUrl ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Loading manual...
                      </div>
                    ) : (
                      <iframe
                        src={pdfUrl}
                        className="w-full h-full border rounded-lg"
                        title="Manual PDF Viewer"
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {!manualTitle && (
                <Card className="flex-1 flex items-center justify-center">
                  <CardContent className="text-center py-12">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Select a manual to view its content and highlight text
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Q&A Generation */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full overflow-auto p-4 space-y-4">
              {/* Input Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Generate Q&A from Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="content">Manual Content</Label>
                    <Textarea
                      id="content"
                      value={contentText}
                      onChange={(e) => setContentText(e.target.value)}
                      rows={8}
                      placeholder="Paste or select text from the manual..."
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="manual_id">Manual ID</Label>
                      <Input
                        id="manual_id"
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value)}
                        placeholder="auto-filled"
                        disabled={!!manualTitle}
                      />
                    </div>
                    <div>
                      <Label htmlFor="page_start">Page Start</Label>
                      <Input
                        id="page_start"
                        type="number"
                        value={pageStart}
                        onChange={(e) => setPageStart(e.target.value)}
                        placeholder="auto-filled"
                      />
                    </div>
                    <div>
                      <Label htmlFor="page_end">Page End</Label>
                      <Input
                        id="page_end"
                        type="number"
                        value={pageEnd}
                        onChange={(e) => setPageEnd(e.target.value)}
                        placeholder="auto-filled"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={loading || !contentText.trim()}
                    className="w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {loading ? 'Generating...' : 'Generate Q&A Pairs'}
                  </Button>
                </CardContent>
              </Card>

              {/* Results */}
              {qaPairs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Generated Q&A Pairs
                      <Badge>{qaPairs.length} pairs</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {qaPairs.map((pair, index) => (
                      <div key={index} className="border-l-4 border-primary pl-4 space-y-2">
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Question {index + 1}</p>
                          <p className="font-medium">{pair.question}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Answer</p>
                          <p className="text-sm whitespace-pre-wrap">{pair.answer}</p>
                        </div>
                        {pair.context && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Context</p>
                            <p className="text-xs text-muted-foreground">{pair.context}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Review these Q&A pairs and manually create training examples for the best ones.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
