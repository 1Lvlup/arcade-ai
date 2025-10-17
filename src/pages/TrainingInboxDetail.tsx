import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrainingAuth } from '@/hooks/useTrainingAuth';
import { TrainingLogin } from '@/components/TrainingLogin';
import { SharedHeader } from '@/components/SharedHeader';
import { DocumentViewerEnhanced } from '@/components/DocumentViewerEnhanced';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
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

interface DetectedClaim {
  text: string;
  hasEvidence: boolean;
}

interface DetectedNumber {
  value: string;
  unit: string;
  context: string;
}

interface EvidenceSpan {
  doc: string;
  page: number;
  text: string;
}

export default function TrainingInboxDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, adminKey } = useTrainingAuth();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState<QueryDetail | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<Set<number>>(new Set());
  const [lastAction, setLastAction] = useState<{ type: string; timestamp: number; data: any } | null>(null);
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

  const toggleEvidence = (index: number) => {
    const newSelected = new Set(selectedEvidence);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedEvidence(newSelected);
  };

  const handleUndo = async () => {
    if (!lastAction) return;

    try {
      const response = await fetch(
        'https://wryxbfnmecjffxolcgfa.supabase.co/functions/v1/training-undo',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey!
          },
          body: JSON.stringify({
            action_type: lastAction.type,
            action_data: lastAction.data,
          })
        }
      );

      if (!response.ok) {
        throw new Error('Undo failed');
      }

      toast.success('Action undone successfully');
      setLastAction(null);
      navigate('/training-hub/inbox');
    } catch (error) {
      console.error('Undo error:', error);
      toast.error('Failed to undo action');
    }
  };

  const handleCreateExample = async () => {
    // Validate numeric policy
    const hasNumbers = query?.numeric_flags && 
      (Array.isArray(query.numeric_flags) ? query.numeric_flags.length > 0 : 
       typeof query.numeric_flags === 'string' && JSON.parse(query.numeric_flags).length > 0);
    
    if (hasNumbers && selectedEvidence.size === 0) {
      toast.error('Numeric Policy: You must select evidence containing these exact numbers before accepting');
      return;
    }

    // If has numbers, verify evidence contains the numbers
    if (hasNumbers && query) {
      const detectedNumbers = typeof query.numeric_flags === 'string'
        ? JSON.parse(query.numeric_flags)
        : query.numeric_flags;
      
      const selectedCitations = Array.from(selectedEvidence).map(idx => query.citations[idx]);
      const evidenceText = selectedCitations.map(c => c.content).join(' ').toLowerCase();
      
      const allNumbersFound = detectedNumbers.every((num: any) => {
        const numberStr = num.value.toLowerCase();
        return evidenceText.includes(numberStr);
      });

      if (!allNumbersFound) {
        toast.error('Evidence Validation Failed: Selected evidence must contain all detected numeric values');
        return;
      }
    }

    // Build evidence spans from selected citations
    const evidenceSpans: EvidenceSpan[] = Array.from(selectedEvidence).map(index => {
      const citation = query!.citations[index];
      return {
        doc: query!.manual_id || 'unknown',
        page: citation.page_start || 0,
        text: citation.content || ''
      };
    });

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
            evidence_spans: evidenceSpans.length > 0 
              ? JSON.stringify(evidenceSpans) 
              : formData.evidence_spans.trim() || null,
            tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
            difficulty: formData.difficulty,
            do_instructions: formData.do_instructions.split('\n').filter(Boolean),
            dont_instructions: formData.dont_instructions.split('\n').filter(Boolean),
            model_type: 'troubleshooting'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create training example');
      }

      const result = await response.json();

      setLastAction({
        type: 'create_example',
        timestamp: Date.now(),
        data: { example_id: result.id, query_id: id },
      });

      toast.success('Training example created successfully');
      navigate('/training-hub/inbox');
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
  
  // Extract claims (split by sentences)
  const detectedClaims: DetectedClaim[] = query.response_text
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 10)
    .map(text => ({
      text: text.trim(),
      hasEvidence: false // TODO: check against evidence spans
    }));

  // Parse numeric flags
  const detectedNumbers: DetectedNumber[] = hasNumericFlags
    ? (typeof query.numeric_flags === 'string'
        ? JSON.parse(query.numeric_flags)
        : query.numeric_flags)
    : [];

  const canUndo = lastAction && (Date.now() - lastAction.timestamp) < 10 * 60 * 1000;

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Review Query">
        <div className="flex gap-2">
          {canUndo && (
            <Button variant="outline" size="sm" onClick={handleUndo}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Undo ({Math.floor((Date.now() - lastAction.timestamp) / 1000)}s ago)
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/training-hub/inbox')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inbox
          </Button>
        </div>
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

            {/* Detected Claims */}
            {detectedClaims.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Detected Claims ({detectedClaims.length})</Label>
                <div className="space-y-1">
                  {detectedClaims.slice(0, 5).map((claim, idx) => (
                    <div key={idx} className="text-sm p-2 bg-muted rounded-md">
                      {claim.text}
                    </div>
                  ))}
                  {detectedClaims.length > 5 && (
                    <p className="text-xs text-muted-foreground">... and {detectedClaims.length - 5} more</p>
                  )}
                </div>
              </div>
            )}

            {/* Numeric Verification Panel */}
            {hasNumericFlags && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-3">
                  <div>
                    <strong>⚠️ Numeric Policy Violation</strong>
                    <p className="text-sm mt-1">
                      This response contains {detectedNumbers.length} numeric value{detectedNumbers.length !== 1 ? 's' : ''} that require verification.
                      Per the training spec, no unverified numbers can be accepted.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Detected Numbers:</p>
                    {detectedNumbers.map((num, idx) => (
                      <div key={idx} className="bg-background p-2 rounded text-sm space-y-1">
                        <div className="font-mono font-bold">{num.value}{num.unit}</div>
                        <div className="text-xs text-muted-foreground">Context: "{num.context}"</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-background p-3 rounded space-y-2">
                    <p className="text-sm font-medium">Resolution Options:</p>
                    <ol className="text-xs space-y-1 list-decimal list-inside">
                      <li>Attach evidence span from retrieved chunks that contains the exact number</li>
                      <li>Replace answer with measurement instructions (e.g., "Use a multimeter to measure voltage at J1-3")</li>
                      <li>Mark as "Cannot Verify" and send to development team</li>
                    </ol>
                  </div>
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

        {/* Detected Claims & Numbers */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Detected Claims ({detectedClaims.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detectedClaims.map((claim, i) => (
                <div key={i} className="p-2 bg-muted rounded text-sm">
                  {claim.text}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Detected Numbers ({detectedNumbers.length})
                {detectedNumbers.length > 0 && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {detectedNumbers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No numeric values detected</p>
              ) : (
                detectedNumbers.map((num, i) => (
                  <div key={i} className="p-3 border rounded space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{num.value} {num.unit}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Context: &quot;...{num.context}...&quot;</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Document Viewer with OCR Overlay & Thumbnails */}
        {query.citations && query.citations.length > 0 && (
          <DocumentViewerEnhanced
            citations={query.citations}
            manualId={query.manual_id}
            selectedEvidence={selectedEvidence}
            onEvidenceSelect={(citation, selectedText) => {
              toast.success('Text selected', {
                description: `"${selectedText.substring(0, 60)}..."`,
              });
            }}
          />
        )}

        {/* Retrieved Context/Evidence - Checkbox Selection */}
        {query.citations && query.citations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Retrieved Evidence - Select to Attach</CardTitle>
              <p className="text-sm text-muted-foreground">
                These chunks were retrieved by the RAG system. Check the ones that support your answer.
                {hasNumericFlags && (
                  <span className="text-destructive font-semibold"> At least one must be selected for numeric verification.</span>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.citations.map((citation: any, index: number) => (
                <div
                  key={index}
                  className={`border rounded p-4 cursor-pointer transition-colors ${
                    selectedEvidence.has(index) ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                  onClick={() => toggleEvidence(index)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedEvidence.has(index)}
                      onCheckedChange={() => toggleEvidence(index)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">
                          {citation.manual_id || 'Unknown Manual'}
                        </Badge>
                        <Badge variant="secondary">
                          Page {citation.page_start || 'N/A'}
                        </Badge>
                      </div>
                      <p className="text-sm">{citation.content}</p>
                      {citation.menu_path && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Section: {citation.menu_path}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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
              <Label htmlFor="evidence_spans">Manual Evidence Spans (optional if citations selected above)</Label>
              <Textarea
                id="evidence_spans"
                value={formData.evidence_spans}
                onChange={(e) => setFormData({ ...formData, evidence_spans: e.target.value })}
                rows={3}
                placeholder="Additional evidence if needed, e.g., Manual p.14 states 'voltage is 120V'"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {selectedEvidence.size} citation(s) selected above
              </p>
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
              disabled={
                creating || 
                !formData.question || 
                !formData.expected_answer ||
                (hasNumericFlags && selectedEvidence.size === 0 && !formData.evidence_spans.trim())
              }
              className="w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {creating ? 'Creating...' : 'Accept & Create Training Example'}
            </Button>

            {hasNumericFlags && selectedEvidence.size === 0 && !formData.evidence_spans.trim() && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Numeric verification required:</strong> Select at least one evidence citation above or provide evidence spans to verify the numbers in this answer.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
