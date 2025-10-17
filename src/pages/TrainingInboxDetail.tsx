import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface QueryDetail {
  id: string;
  query_text: string;
  response_text: string;
  quality_tier: string;
  quality_score: number;
  numeric_flags: any[];
  claim_coverage: number;
  manual_id: string | null;
  created_at: string;
  top_doc_pages: number[];
  citations: any[];
}

export default function TrainingInboxDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, adminKey } = useTrainingAuth();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState<QueryDetail | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    expected_answer: '',
    context: '',
    evidence_spans: '',
    tags: '',
    difficulty: 'medium',
    do_instructions: '',
    dont_instructions: ''
  });

  useEffect(() => {
    if (isAuthenticated && id) {
      fetchQueryDetail();
    }
  }, [isAuthenticated, id]);

  const fetchQueryDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        'https://wryxbfnmecjffxolcgfa.supabase.co/functions/v1/training-query-detail',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey!
          },
          body: JSON.stringify({ query_id: id })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch query details');
      }

      const data = await response.json();
      setQuery(data);
      
      // Pre-populate form
      setFormData({
        question: data.query_text || '',
        expected_answer: data.response_text || '',
        context: data.citations?.map((c: any) => c.content).join('\n\n---\n\n') || '',
        evidence_spans: '',
        tags: '',
        difficulty: 'medium',
        do_instructions: '',
        dont_instructions: ''
      });
    } catch (error) {
      console.error('Error fetching query detail:', error);
      toast.error('Failed to load query details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExample = async () => {
    // Validate numeric verification requirement
    const hasNumbers = /\d/.test(formData.expected_answer) || /\d/.test(formData.expected_answer);
    if (hasNumbers && !formData.evidence_spans.trim()) {
      toast.error('Numbers detected: Evidence spans are required for numeric claims');
      return;
    }

    try {
      setCreating(true);
      const response = await fetch(
        'https://wryxbfnmecjffxolcgfa.supabase.co/functions/v1/training-create-example',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey!
          },
          body: JSON.stringify({
            source_query_id: id,
            question: formData.question,
            expected_answer: formData.expected_answer,
            context: formData.context,
            evidence_spans: formData.evidence_spans.trim() ? formData.evidence_spans : null,
            tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
            difficulty: formData.difficulty,
            do_instructions: formData.do_instructions.split('\n').filter(Boolean),
            dont_instructions: formData.dont_instructions.split('\n').filter(Boolean),
            model_type: 'chat'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create training example');
      }

      toast.success('Training example created successfully');
      navigate('/training/inbox');
    } catch (error) {
      console.error('Error creating example:', error);
      toast.error('Failed to create training example');
    } finally {
      setCreating(false);
    }
  };

  if (!isAuthenticated) {
    return <TrainingLogin />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SharedHeader title="Loading..." />
        <div className="container mx-auto p-6">
          <p className="text-muted-foreground">Loading query details...</p>
        </div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="min-h-screen bg-background">
        <SharedHeader title="Not Found" />
        <div className="container mx-auto p-6">
          <p className="text-destructive">Query not found</p>
        </div>
      </div>
    );
  }

  const hasNumericFlags = query.numeric_flags && query.numeric_flags.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Review Query">
        <Button variant="ghost" size="sm" onClick={() => navigate('/training/inbox')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inbox
        </Button>
      </SharedHeader>

      <div className="container mx-auto p-6 space-y-6">
        {/* Quality Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Quality Assessment
              <Badge variant={query.quality_tier === 'high' ? 'default' : query.quality_tier === 'medium' ? 'secondary' : 'destructive'}>
                {query.quality_tier}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Quality Score</p>
                <p className="text-2xl font-bold">{(query.quality_score * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Claim Coverage</p>
                <p className="text-2xl font-bold">{(query.claim_coverage * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Numeric Flags</p>
                <p className="text-2xl font-bold">{query.numeric_flags?.length || 0}</p>
              </div>
            </div>

            {hasNumericFlags && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Numbers detected:</strong> This response contains numeric values that require verification.
                  You must provide evidence spans when creating a training example.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Query & Response */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>User Question</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{query.query_text}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Model Response</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{query.response_text}</p>
            </CardContent>
          </Card>
        </div>

        {/* Create Training Example Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Training Example</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="question">Question</Label>
              <Textarea
                id="question"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="expected_answer">Expected Answer</Label>
              <Textarea
                id="expected_answer"
                value={formData.expected_answer}
                onChange={(e) => setFormData({ ...formData, expected_answer: e.target.value })}
                rows={5}
              />
            </div>

            <div>
              <Label htmlFor="context">Context</Label>
              <Textarea
                id="context"
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                rows={4}
                placeholder="Relevant context from manual..."
              />
            </div>

            <div>
              <Label htmlFor="evidence_spans">Evidence Spans {hasNumericFlags && <span className="text-destructive">*</span>}</Label>
              <Textarea
                id="evidence_spans"
                value={formData.evidence_spans}
                onChange={(e) => setFormData({ ...formData, evidence_spans: e.target.value })}
                rows={3}
                placeholder="e.g., Manual p.14 states 'voltage is 120V'"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="troubleshooting, safety, wiring"
                />
              </div>

              <div>
                <Label htmlFor="difficulty">Difficulty</Label>
                <select
                  id="difficulty"
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="do_instructions">DO Instructions (one per line)</Label>
              <Textarea
                id="do_instructions"
                value={formData.do_instructions}
                onChange={(e) => setFormData({ ...formData, do_instructions: e.target.value })}
                rows={3}
                placeholder="Use specific page references&#10;Mention safety warnings&#10;Provide step-by-step guidance"
              />
            </div>

            <div>
              <Label htmlFor="dont_instructions">DON'T Instructions (one per line)</Label>
              <Textarea
                id="dont_instructions"
                value={formData.dont_instructions}
                onChange={(e) => setFormData({ ...formData, dont_instructions: e.target.value })}
                rows={3}
                placeholder="Don't make assumptions without manual support&#10;Don't skip safety precautions"
              />
            </div>

            <Button
              onClick={handleCreateExample}
              disabled={creating || !formData.question || !formData.expected_answer}
              className="w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {creating ? 'Creating...' : 'Create Training Example'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
