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
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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
  const [pageStart, setPageStart] = useState('');
  const [pageEnd, setPageEnd] = useState('');
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);

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

      <div className="container mx-auto p-6 space-y-6">
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            Generate training question-answer pairs from manual content using AI. 
            Paste a section of manual text and we'll create realistic Q&A examples.
          </AlertDescription>
        </Alert>

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
                rows={10}
                placeholder="Paste manual content here... (e.g., troubleshooting section, wiring diagram description, etc.)"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="manual_id">Manual ID (optional)</Label>
                <Input
                  id="manual_id"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="e.g., big-bass-wheel"
                />
              </div>
              <div>
                <Label htmlFor="page_start">Page Start (optional)</Label>
                <Input
                  id="page_start"
                  type="number"
                  value={pageStart}
                  onChange={(e) => setPageStart(e.target.value)}
                  placeholder="e.g., 14"
                />
              </div>
              <div>
                <Label htmlFor="page_end">Page End (optional)</Label>
                <Input
                  id="page_end"
                  type="number"
                  value={pageEnd}
                  onChange={(e) => setPageEnd(e.target.value)}
                  placeholder="e.g., 18"
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
                  Not all generated pairs may be accurate or useful.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
