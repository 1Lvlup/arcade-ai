import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrainingAuth } from '@/hooks/useTrainingAuth';
import { TrainingLogin } from '@/components/TrainingLogin';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Download, FileJson, FileText, Table } from 'lucide-react';
import { toast } from 'sonner';

type ExportFormat = 'jsonl' | 'triples' | 'csv';

export default function TrainingExport() {
  const navigate = useNavigate();
  const { isAuthenticated, adminKey } = useTrainingAuth();
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('jsonl');
  const [filters, setFilters] = useState({
    model_type: '',
    difficulty: '',
    tags: ''
  });
  const [exportData, setExportData] = useState<{ content: string; count: number } | null>(null);

  const handleExport = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        'https://wryxbfnmecjffxolcgfa.supabase.co/functions/v1/training-export',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey!
          },
          body: JSON.stringify({
            format,
            filters: {
              model_type: filters.model_type || undefined,
              difficulty: filters.difficulty || undefined,
              tags: filters.tags ? filters.tags.split(',').map(t => t.trim()) : undefined
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export training data');
      }

      const data = await response.json();
      setExportData(data);
      toast.success(`Exported ${data.count} training examples`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export training data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!exportData) return;

    const extensions: Record<ExportFormat, string> = {
      jsonl: 'jsonl',
      triples: 'txt',
      csv: 'csv'
    };

    const blob = new Blob([exportData.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-export.${extensions[format]}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download started');
  };

  if (!isAuthenticated) {
    return <TrainingLogin />;
  }

  const formatIcons: Record<ExportFormat, any> = {
    jsonl: FileJson,
    triples: FileText,
    csv: Table
  };

  const FormatIcon = formatIcons[format];

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Export Training Data">
        <Button variant="ghost" size="sm" onClick={() => navigate('/training')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Hub
        </Button>
      </SharedHeader>

      <div className="container mx-auto p-6 space-y-6">
        <Alert>
          <Download className="h-4 w-4" />
          <AlertDescription>
            Export approved training examples in various formats for fine-tuning or external use.
          </AlertDescription>
        </Alert>

        {/* Export Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Export Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Export Format</Label>
              <div className="grid grid-cols-3 gap-4 mt-2">
                <Button
                  variant={format === 'jsonl' ? 'default' : 'outline'}
                  onClick={() => setFormat('jsonl')}
                  className="flex items-center gap-2"
                >
                  <FileJson className="h-4 w-4" />
                  JSONL
                </Button>
                <Button
                  variant={format === 'triples' ? 'default' : 'outline'}
                  onClick={() => setFormat('triples')}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Triples
                </Button>
                <Button
                  variant={format === 'csv' ? 'default' : 'outline'}
                  onClick={() => setFormat('csv')}
                  className="flex items-center gap-2"
                >
                  <Table className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Filters (optional)</Label>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Input
                    placeholder="Model type (e.g., chat)"
                    value={filters.model_type}
                    onChange={(e) => setFilters({ ...filters, model_type: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Difficulty (easy/medium/hard)"
                    value={filters.difficulty}
                    onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Tags (comma-separated)"
                    value={filters.tags}
                    onChange={(e) => setFilters({ ...filters, tags: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={loading}
              className="w-full"
            >
              <FormatIcon className="h-4 w-4 mr-2" />
              {loading ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
            </Button>
          </CardContent>
        </Card>

        {/* Export Preview */}
        {exportData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Export Preview
                <Badge>{exportData.count} examples</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-md p-4 max-h-96 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {exportData.content.substring(0, 2000)}
                  {exportData.content.length > 2000 && '\n\n... (truncated for preview)'}
                </pre>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download {format.toUpperCase()}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(exportData.content);
                    toast.success('Copied to clipboard');
                  }}
                >
                  Copy to Clipboard
                </Button>
              </div>

              <Alert>
                <FormatIcon className="h-4 w-4" />
                <AlertDescription>
                  <strong>{format.toUpperCase()} Format:</strong>
                  {format === 'jsonl' && ' Each line is a JSON object with system/user/assistant messages'}
                  {format === 'triples' && ' Question, Answer, Context separated by triple newlines'}
                  {format === 'csv' && ' Spreadsheet format with headers: question, answer, context, tags'}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
