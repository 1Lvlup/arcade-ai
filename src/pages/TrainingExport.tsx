import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrainingAuth } from '@/hooks/useTrainingAuth';
import { TrainingLogin } from '@/components/TrainingLogin';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, FileJson, FileText, Table } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ExportHistory {
  id: string;
  name: string;
  example_count: number;
  file_url: string;
  created_at: string;
  created_by: string;
}

export default function TrainingExport() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useTrainingAuth();
  const [loadingState, setLoadingState] = useState(false);
  const [format, setFormat] = useState<'jsonl' | 'triples' | 'csv'>('jsonl');
  const [exportName, setExportName] = useState('');
  const [minQuality, setMinQuality] = useState('');
  const [exports, setExports] = useState<ExportHistory[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchExportHistory();
    }
  }, [isAuthenticated]);

  const fetchExportHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('training_exports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setExports(data || []);
    } catch (error) {
      console.error('Error fetching export history:', error);
    }
  };

  const handleExport = async () => {
    if (!exportName.trim()) {
      toast.error('Please provide an export name');
      return;
    }

    try {
      setLoadingState(true);

      const { supabase } = await import('@/integrations/supabase/client');
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch(
        'https://wryxbfnmecjffxolcgfa.supabase.co/functions/v1/training-export',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`
          },
          body: JSON.stringify({
            format,
            name: exportName,
            filters: {
              min_quality: minQuality ? parseFloat(minQuality) : undefined,
              approved_only: true
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const data = await response.json();
      
      // Download the file
      const blob = new Blob([data.content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Exported ${data.count} examples as ${format.toUpperCase()}`);
      fetchExportHistory();
      setExportName('');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export training data');
    } finally {
      setLoadingState(false);
    }
  };

  if (loading) {
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
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Export Training Data">
        <Button variant="ghost" size="sm" onClick={() => navigate('/training-hub')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Hub
        </Button>
      </SharedHeader>

      <div className="container mx-auto p-6 space-y-6">
        {/* Export Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="export-name">Export Name</Label>
              <Input
                id="export-name"
                value={exportName}
                onChange={(e) => setExportName(e.target.value)}
                placeholder="e.g., production-v1"
              />
            </div>

            <div>
              <Label htmlFor="format">Export Format</Label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jsonl">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      JSONL (Instruction Tuning)
                    </div>
                  </SelectItem>
                  <SelectItem value="triples">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Triples (Reranker)
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <Table className="h-4 w-4" />
                      CSV (FAQ)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="min-quality">Minimum Quality Score (optional)</Label>
              <Input
                id="min-quality"
                type="number"
                step="0.1"
                value={minQuality}
                onChange={(e) => setMinQuality(e.target.value)}
                placeholder="e.g., 0.7"
              />
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <p className="font-medium">Format Details:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li><strong>JSONL:</strong> {"{"}"prompt": "Q: ...", "completion": "..."{"}"}</li>
                <li><strong>Triples:</strong> {"{"}"query": "...", "positive": "...", "negative": "..."{"}"}</li>
                <li><strong>CSV:</strong> question,answer,evidence</li>
              </ul>
            </div>

            <Button
              onClick={handleExport}
            disabled={loadingState || !exportName.trim()}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            {loadingState ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
            </Button>
          </CardContent>
        </Card>

        {/* Export History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Exports</CardTitle>
          </CardHeader>
          <CardContent>
            {exports.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No exports yet</p>
            ) : (
              <div className="space-y-2">
                {exports.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{exp.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {exp.example_count} examples • {new Date(exp.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary">{exp.created_by}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
