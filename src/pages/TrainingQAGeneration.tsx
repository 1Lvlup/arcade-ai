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
import { ArrowLeft, Sparkles, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface QAPair {
  question: string;
  answer: string;
  context?: string;
}

export default function TrainingQAGeneration() {
  const navigate = useNavigate();
  const { isAuthenticated, adminKey } = useTrainingAuth();
  const [loading, setLoading] = useState(false);
  const [contentText, setContentText] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [pageStart, setPageStart] = useState('');
  const [pageEnd, setPageEnd] = useState('');
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [chunks, setChunks] = useState<Array<{ chunk_text: string; page_number: number }>>([]);
  const [selectedText, setSelectedText] = useState('');

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
      setChunks([{ chunk_text: urlData.signedUrl, page_number: 0 }]);
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
      setChunks([]);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 10) {
      setSelectedText(text);
    }
  };

  const handleUseSelectedText = () => {
    if (!selectedText) {
      toast.error('No text selected');
      return;
    }

    setContentText(selectedText);
    
    // Auto-fill page range if we can determine it
    const matchingChunks = chunks.filter(c => c.chunk_text.includes(selectedText));
    if (matchingChunks.length > 0) {
      const pages = matchingChunks.map(c => c.page_number).filter(p => p != null);
      if (pages.length > 0) {
        setPageStart(Math.min(...pages).toString());
        setPageEnd(Math.max(...pages).toString());
      }
    }
    
    toast.success('Text populated! Edit if needed, then generate Q&A.');
  };

  const handleGenerate = async () => {
    if (!contentText.trim()) {
      toast.error('Please provide content to generate Q&A from');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        'https://wryxbfnmecjffxolcgfa.supabase.co/functions/v1/training-generate-qa',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey!
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

  if (!isAuthenticated) {
    return <TrainingLogin />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Q&A Generation">
        <Button variant="ghost" size="sm" onClick={() => navigate('/training')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Hub
        </Button>
      </SharedHeader>

      <div className="container mx-auto p-6 space-y-4">
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            Select a manual, highlight text, then generate Q&A pairs. The selected text will auto-populate the content field.
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
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{manualTitle}</span>
                      {selectedText && (
                        <Button size="sm" onClick={handleUseSelectedText}>
                          <Copy className="h-4 w-4 mr-2" />
                          Use Selected Text
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden">
                    {chunks.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Loading manual...
                      </div>
                    ) : (
                      <iframe
                        src={chunks[0].chunk_text}
                        className="w-full h-full border rounded-lg"
                        title="Manual PDF Viewer"
                        onLoad={() => {
                          // PDF loaded successfully
                        }}
                      />
                    )}
                    
                    {selectedText && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <p className="font-medium mb-1">Selected Text ({selectedText.length} chars):</p>
                        <p className="text-muted-foreground line-clamp-3">&quot;{selectedText}&quot;</p>
                      </div>
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
