import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Folder, Trash2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CodebaseIndexerProps {
  onIndexComplete?: () => void;
}

export function CodebaseIndexer({ onIndexComplete }: CodebaseIndexerProps) {
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [progress, setProgress] = useState(0);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const shouldIndexFile = (path: string): boolean => {
    const skipPatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.env',
      'package-lock.json',
      'yarn.lock',
      'bun.lockb',
      '.DS_Store',
      'tsconfig.tsbuildinfo',
    ];
    
    const allowedExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.css', '.json', '.md',
      '.sql', '.toml', '.yaml', '.yml',
      '.html', '.py',
    ];

    // Skip if matches any skip pattern
    if (skipPatterns.some(pattern => path.includes(pattern))) {
      return false;
    }

    // Only include files with allowed extensions
    return allowedExtensions.some(ext => path.endsWith(ext));
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsIndexing(true);
    setProgress(0);
    
    try {
      toast({ title: 'Processing files...', description: 'Reading and filtering your codebase' });

      // Convert FileList to array and filter
      const filesToIndex: any[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // @ts-ignore - webkitRelativePath is available on File objects from directory input
        const path = file.webkitRelativePath || file.name;
        
        if (shouldIndexFile(path) && file.size <= 500000) {
          try {
            const content = await file.text();
            filesToIndex.push({ path, content });
          } catch (error) {
            console.warn(`Failed to read ${path}:`, error);
          }
        }
      }

      setTotalFiles(filesToIndex.length);

      if (filesToIndex.length === 0) {
        toast({ 
          title: 'No files found', 
          description: 'No indexable files found in the selected directory',
          variant: 'destructive' 
        });
        return;
      }

      // Index files in batches
      const batchSize = 50;
      for (let i = 0; i < filesToIndex.length; i += batchSize) {
        const batch = filesToIndex.slice(i, i + batchSize);
        
        const { error } = await supabase.functions.invoke('index-codebase', {
          body: {
            action: 'index',
            files: batch,
          }
        });

        if (error) throw error;

        setIndexedCount(Math.min(i + batchSize, filesToIndex.length));
        setProgress((Math.min(i + batchSize, filesToIndex.length) / filesToIndex.length) * 100);
      }

      toast({ 
        title: 'Success!', 
        description: `Indexed ${filesToIndex.length} files from your codebase` 
      });

      onIndexComplete?.();
    } catch (error: any) {
      console.error('Error indexing codebase:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to index codebase',
        variant: 'destructive' 
      });
    } finally {
      setIsIndexing(false);
      setProgress(0);
      setIndexedCount(0);
      setTotalFiles(0);
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  };

  const clearIndex = async () => {
    try {
      const { error } = await supabase.functions.invoke('index-codebase', {
        body: { action: 'clear' }
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Codebase index cleared' });
      onIndexComplete?.();
    } catch (error) {
      console.error('Error clearing index:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to clear index',
        variant: 'destructive' 
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Folder className="h-5 w-5" />
          Codebase Indexer
        </CardTitle>
        <CardDescription>
          Index your entire project directory for AI assistance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Select your project folder to index all code files. The AI will have full context of your codebase.
          </AlertDescription>
        </Alert>

        {isIndexing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Indexing files...</span>
              <span>{indexedCount} / {totalFiles}</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore - webkitdirectory is supported but not in types
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          className="hidden"
        />

        <div className="flex gap-2">
          <Button 
            onClick={() => folderInputRef.current?.click()}
            disabled={isIndexing}
            className="flex-1"
          >
            {isIndexing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Indexing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Select Folder
              </>
            )}
          </Button>
          <Button 
            onClick={clearIndex} 
            disabled={isIndexing}
            variant="outline"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Index
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Supported files: TypeScript, JavaScript, CSS, JSON, Markdown, SQL, and more
        </p>
      </CardContent>
    </Card>
  );
}
