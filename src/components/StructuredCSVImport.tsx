import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Image, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportResult {
  type: 'chunks' | 'figures' | 'qa' | 'images';
  success: boolean;
  count?: number;
  error?: string;
}

export const StructuredCSVImport = () => {
  const [chunksFile, setChunksFile] = useState<File | null>(null);
  const [figuresFile, setFiguresFile] = useState<File | null>(null);
  const [qaFile, setQaFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<FileList | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  // Manual metadata
  const [vendor, setVendor] = useState('ICE');
  const [title, setTitle] = useState('Down the Clown');
  const [version, setVersion] = useState('Rev S');
  const [publishedOn, setPublishedOn] = useState('2023-08-16');

  const handleImport = async () => {
    if (!chunksFile && !figuresFile && !qaFile && !imageFiles) {
      toast.error('Please select at least one file to import');
      return;
    }

    setImporting(true);
    setResults([]);

    try {
      // Read CSV files
      const chunksData = chunksFile ? await readCSV(chunksFile) : null;
      const figuresData = figuresFile ? await readCSV(figuresFile) : null;
      const qaData = qaFile ? await readCSV(qaFile) : null;

      // Call edge function to process import
      const { data, error } = await supabase.functions.invoke('structured-csv-import', {
        body: {
          manual: {
            vendor,
            title,
            version,
            published_on: publishedOn,
            notes: `Imported via CSV upload on ${new Date().toISOString()}`
          },
          chunks: chunksData,
          figures: figuresData,
          qa: qaData
        }
      });

      if (error) throw error;

      const manualId = data.manual_id;
      const importResults: ImportResult[] = [
        { type: 'chunks', success: true, count: data.chunks_count },
        { type: 'figures', success: true, count: data.figures_count },
        { type: 'qa', success: true, count: data.qa_count }
      ];

      // Upload images if provided
      if (imageFiles && imageFiles.length > 0) {
        try {
          const imageResult = await uploadImages(imageFiles, manualId);
          importResults.push({ type: 'images', success: true, count: imageResult.count });
          toast.success(`Uploaded ${imageResult.count} images`);
        } catch (imgError: any) {
          importResults.push({ type: 'images', success: false, error: imgError.message });
          toast.error(`Image upload failed: ${imgError.message}`);
        }
      }

      setResults(importResults);
      toast.success(`Import complete! Manual ID: ${manualId}`);

      // Reset form
      setChunksFile(null);
      setFiguresFile(null);
      setQaFile(null);
      setImageFiles(null);

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const readCSV = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        resolve(rows);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseCSVLine(lines[i]);
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      data.push(row);
    }

    return data;
  };

  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const uploadImages = async (files: FileList, manualId: string) => {
    let count = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      
      // Extract path structure from filename (e.g., "p001_img01.png")
      const path = `${manualId}/${fileName}`;
      
      const { error } = await supabase.storage
        .from('postparse')
        .upload(path, file, { upsert: true });

      if (error) throw error;
      count++;
    }
    return { count };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Structured CSV Import</CardTitle>
        <CardDescription>
          Import manual data from structured CSV files with rich metadata
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Manual Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="version">Version</Label>
            <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="published">Published Date</Label>
            <Input id="published" type="date" value={publishedOn} onChange={(e) => setPublishedOn(e.target.value)} />
          </div>
        </div>

        {/* CSV Files */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chunks">Text Chunks CSV</Label>
            <Input
              id="chunks"
              type="file"
              accept=".csv"
              onChange={(e) => setChunksFile(e.target.files?.[0] || null)}
            />
            {chunksFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {chunksFile.name}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="figures">Figures CSV</Label>
            <Input
              id="figures"
              type="file"
              accept=".csv"
              onChange={(e) => setFiguresFile(e.target.files?.[0] || null)}
            />
            {figuresFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {figuresFile.name}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="qa">QA Pairs CSV</Label>
            <Input
              id="qa"
              type="file"
              accept=".csv"
              onChange={(e) => setQaFile(e.target.files?.[0] || null)}
            />
            {qaFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {qaFile.name}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="images">Images (PNG files)</Label>
            <Input
              id="images"
              type="file"
              accept="image/png"
              multiple
              onChange={(e) => setImageFiles(e.target.files)}
            />
            {imageFiles && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Image className="h-4 w-4" />
                {imageFiles.length} files selected
              </div>
            )}
          </div>
        </div>

        <Button onClick={handleImport} disabled={importing} className="w-full">
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Import All
            </>
          )}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Import Results:</h4>
            {results.map((result, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="capitalize">{result.type}</span>:
                {result.success ? (
                  <span className="text-muted-foreground">{result.count} records</span>
                ) : (
                  <span className="text-red-500">{result.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
