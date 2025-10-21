import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database, Upload, Image, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ChunksFile {
  file: File;
  manual_id: string;
}

interface ImagesFile {
  file: File;
  manual_id: string;
}

export function BulkManualImport() {
  const [chunksFiles, setChunksFiles] = useState<ChunksFile[]>([]);
  const [imagesFiles, setImagesFiles] = useState<ImagesFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<Array<{ manual_id: string; status: string; message: string }>>([]);
  const { toast } = useToast();

  const handleChunksUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));
    
    const newFiles = jsonFiles.map(file => ({
      file,
      manual_id: file.name.replace('.json', '').replace(/_chunks$/, '')
    }));
    
    setChunksFiles(prev => [...prev, ...newFiles]);
  };

  const handleImagesUpload = (manual_id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => 
      f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );
    
    const newFiles = imageFiles.map(file => ({
      file,
      manual_id
    }));
    
    setImagesFiles(prev => [...prev, ...newFiles]);
  };

  const removeChunksFile = (index: number) => {
    setChunksFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (chunksFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one chunks JSON file',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setResults([]);
    const importResults: Array<{ manual_id: string; status: string; message: string }> = [];

    for (const chunksFile of chunksFiles) {
      try {
        // Read chunks JSON
        const chunksText = await chunksFile.file.text();
        const chunksData = JSON.parse(chunksText);

        // Get associated images for this manual
        const manualImages = imagesFiles.filter(img => img.manual_id === chunksFile.manual_id);

        // Call import edge function
        const { data, error } = await supabase.functions.invoke('bulk-import-manual', {
          body: {
            manual_id: chunksFile.manual_id,
            chunks: chunksData.chunks || chunksData,
            figures: chunksData.figures || [],
            metadata: chunksData.metadata || {},
            images: manualImages.length
          }
        });

        if (error) throw error;

        // Upload images if any
        if (manualImages.length > 0) {
          for (const imgFile of manualImages) {
            const imgPath = `${chunksFile.manual_id}/${imgFile.file.name}`;
            const { error: uploadError } = await supabase.storage
              .from('postparse')
              .upload(imgPath, imgFile.file, { upsert: true });

            if (uploadError) {
              console.error('Image upload error:', uploadError);
            }
          }
        }

        importResults.push({
          manual_id: chunksFile.manual_id,
          status: 'success',
          message: `Imported ${data.chunks_created} chunks, ${data.figures_created || 0} figures with metadata, ${manualImages.length} images`
        });

      } catch (error) {
        console.error(`Import error for ${chunksFile.manual_id}:`, error);
        importResults.push({
          manual_id: chunksFile.manual_id,
          status: 'error',
          message: error.message || 'Import failed'
        });
      }
    }

    setResults(importResults);
    setImporting(false);

    const successCount = importResults.filter(r => r.status === 'success').length;
    toast({
      title: 'Import complete',
      description: `Successfully imported ${successCount} of ${chunksFiles.length} manuals`,
    });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-primary" />
          <span>Bulk Import Pre-Parsed Manuals</span>
        </CardTitle>
        <CardDescription>
          Upload pre-parsed and chunked manual data with associated images
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="chunks-files">Chunks JSON Files</Label>
          <Input
            id="chunks-files"
            type="file"
            accept=".json"
            multiple
            onChange={handleChunksUpload}
            disabled={importing}
          />
          <p className="text-xs text-muted-foreground">
            Select one or more JSON files containing chunks data. 
            File name (without .json) will be used as manual_id.
          </p>
        </div>

        {chunksFiles.length > 0 && (
          <div className="space-y-3">
            <Label>Selected Manuals ({chunksFiles.length})</Label>
            {chunksFiles.map((cf, index) => (
              <div key={index} className="glass-card p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="font-mono text-sm">{cf.manual_id}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeChunksFile(index)}
                    disabled={importing}
                  >
                    Remove
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`images-${cf.manual_id}`} className="text-xs">
                    <Image className="h-3 w-3 inline mr-1" />
                    Upload Images for {cf.manual_id}
                  </Label>
                  <Input
                    id={`images-${cf.manual_id}`}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImagesUpload(cf.manual_id)}
                    disabled={importing}
                  />
                  {imagesFiles.filter(img => img.manual_id === cf.manual_id).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {imagesFiles.filter(img => img.manual_id === cf.manual_id).length} image(s) selected
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={chunksFiles.length === 0 || importing}
          className="w-full"
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Import {chunksFiles.length} Manual{chunksFiles.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-2">
            <Label>Import Results</Label>
            {results.map((result, index) => (
              <div
                key={index}
                className={`flex items-start space-x-2 p-3 rounded-md ${
                  result.status === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}
              >
                {result.status === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{result.manual_id}</p>
                  <p className="text-xs text-muted-foreground">{result.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p className="font-medium">Expected JSON format:</p>
          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`{
  "metadata": {
    "canonical_title": "Game Title",
    "platform": "Arcade",
    "manufacturer": "Company"
  },
  "chunks": [
    {
      "content": "text content",
      "page_start": 1,
      "page_end": 2,
      "menu_path": "Section > Subsection",
      "embedding": [0.1, 0.2, ...] // optional
    }
  ],
  "figures": [
    {
      "image_name": "image.png",
      "page_number": 5,
      "caption_text": "Gate system diagram",
      "ocr_text": "Text from image",
      "figure_type": "diagram",
      "kind": "schematic",
      "semantic_tags": ["gates", "wiring"],
      "keywords": ["J1", "J2", "5V"],
      "detected_components": {"connectors": ["J1"]},
      "quality_score": 0.95,
      "embedding_text": [0.1, ...] // optional
    }
  ]
}`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
