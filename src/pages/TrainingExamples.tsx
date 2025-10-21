import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrainingAuth } from '@/hooks/useTrainingAuth';
import { TrainingLogin } from '@/components/TrainingLogin';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TrainingExample {
  id: string;
  question: string;
  answer: string;
  evidence_spans: any;
  tags: string[];
  is_approved: boolean;
  difficulty: string;
  created_at: string;
  doc_id: string;
  verified_by: string;
  verified_at: string;
}

export default function TrainingExamples() {
  const navigate = useNavigate();
  const { isAuthenticated } = useTrainingAuth();
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [approvedOnly, setApprovedOnly] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchExamples();
    }
  }, [isAuthenticated, approvedOnly]);

  const fetchExamples = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('training_examples')
        .select('*')
        .order('created_at', { ascending: false });

      if (approvedOnly) {
        query = query.eq('is_approved', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExamples(data || []);
    } catch (error) {
      console.error('Error fetching examples:', error);
      toast.error('Failed to load training examples');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this training example?')) return;

    try {
      const { error } = await supabase
        .from('training_examples')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Training example deleted');
      fetchExamples();
    } catch (error) {
      console.error('Error deleting example:', error);
      toast.error('Failed to delete example');
    }
  };

  const toggleApproval = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('training_examples')
        .update({ is_approved: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(`Example ${!currentStatus ? 'approved' : 'unapproved'}`);
      fetchExamples();
    } catch (error) {
      console.error('Error updating approval:', error);
      toast.error('Failed to update approval status');
    }
  };

  if (!isAuthenticated) {
    return <TrainingLogin />;
  }

  const filteredExamples = examples.filter(ex =>
    !filter || 
    ex.question.toLowerCase().includes(filter.toLowerCase()) ||
    ex.answer.toLowerCase().includes(filter.toLowerCase()) ||
    ex.tags?.some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Training Examples">
        <Button variant="ghost" size="sm" onClick={() => navigate('/training')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Hub
        </Button>
      </SharedHeader>

      <div className="container mx-auto p-6 space-y-6">
        {/* Controls */}
        <div className="flex gap-4 items-center">
          <Input
            placeholder="Filter by question, answer, or tags..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-md"
          />
          <Button
            variant={approvedOnly ? 'default' : 'outline'}
            onClick={() => setApprovedOnly(!approvedOnly)}
          >
            {approvedOnly ? 'Approved Only' : 'All Examples'}
          </Button>
          <div className="ml-auto">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {filteredExamples.length} examples
            </Badge>
          </div>
        </div>

        {/* Examples List */}
        {loading ? (
          <Card className="p-6">
            <p className="text-center text-muted-foreground">Loading examples...</p>
          </Card>
        ) : filteredExamples.length === 0 ? (
          <Card className="p-6">
            <p className="text-center text-muted-foreground">No training examples found</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredExamples.map((example) => (
              <Card key={example.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {example.is_approved ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                        {example.difficulty && (
                          <Badge variant="outline">{example.difficulty}</Badge>
                        )}
                        {example.tags?.map(tag => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                      <CardTitle className="text-base font-semibold">
                        {example.question}
                      </CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleApproval(example.id, example.is_approved)}
                      >
                        {example.is_approved ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(example.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Answer:</p>
                    <p className="text-sm whitespace-pre-wrap">{example.answer}</p>
                  </div>
                  {example.evidence_spans && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Evidence:</p>
                      <p className="text-xs text-muted-foreground">{example.evidence_spans}</p>
                    </div>
                  )}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Doc: {example.doc_id || 'N/A'}</span>
                    <span>Created: {new Date(example.created_at).toLocaleDateString()}</span>
                    {example.verified_by && (
                      <span>Verified by: {example.verified_by}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
