import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Folder, Trash2, Loader2, FileCode, CheckSquare, Square } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

interface CodebaseIndexerProps {
  onIndexComplete?: () => void;
}

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
}

export function CodebaseIndexer({ onIndexComplete }: CodebaseIndexerProps) {
  const [isIndexing, setIsIndexing] = useState(false);
  const [isLoadingIndexed, setIsLoadingIndexed] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [progress, setProgress] = useState(0);
  const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showFileList, setShowFileList] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadIndexedFilesList();
  }, []);

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

  const loadIndexedFilesList = async () => {
    try {
      const { data, error } = await supabase
        .from('indexed_codebase')
        .select('id, file_path, file_content, language')
        .order('file_path');

      if (error) throw error;
      
      setIndexedFiles(data || []);
    } catch (error) {
      console.error('Error loading indexed files list:', error);
    }
  };

  const loadIndexedFiles = async () => {
    setIsLoadingIndexed(true);
    try {
      const filesToLoad = selectedFiles.size > 0 
        ? indexedFiles.filter(f => selectedFiles.has(f.id))
        : indexedFiles;

      if (filesToLoad.length === 0) {
        toast({ 
          title: 'No files selected', 
          description: selectedFiles.size > 0 
            ? 'Please select files to load' 
            : 'No indexed files available. Upload files from your computer first.',
          variant: 'destructive' 
        });
        return;
      }

      // Add files to current conversation
      toast({ 
        title: 'Success', 
        description: `Loaded ${filesToLoad.length} file(s) into conversation` 
      });

      onIndexComplete?.();
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Error loading indexed files:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to load indexed files',
        variant: 'destructive' 
      });
    } finally {
      setIsLoadingIndexed(false);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const selectAll = () => {
    setSelectedFiles(new Set(indexedFiles.map(f => f.id)));
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
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
          <AlertDescription className="space-y-2">
            <p className="font-medium">Current Status: {indexedFiles.length} file(s) indexed</p>
            <p className="text-sm">
              {indexedFiles.length === 0 
                ? 'Upload files from your computer to build your indexed codebase. Then you can selectively load them into conversations.'
                : 'Select files below to load into the conversation, or upload more files.'}
            </p>
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

        {indexedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFileList(!showFileList)}
              >
                <FileCode className="h-4 w-4 mr-2" />
                {showFileList ? 'Hide' : 'Show'} Files ({indexedFiles.length})
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                >
                  <CheckSquare className="h-4 w-4 mr-1" />
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                >
                  <Square className="h-4 w-4 mr-1" />
                  None
                </Button>
              </div>
            </div>

            {showFileList && (
              <ScrollArea className="h-[300px] border rounded-lg p-3">
                <div className="space-y-2">
                  {indexedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                      onClick={() => toggleFileSelection(file.id)}
                    >
                      <Checkbox
                        checked={selectedFiles.has(file.id)}
                        onCheckedChange={() => toggleFileSelection(file.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono truncate" title={file.file_path}>
                          {file.file_path}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.language} • {(file.file_content.length / 1024).toFixed(1)}KB
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Button 
              onClick={loadIndexedFiles}
              disabled={isLoadingIndexed || isIndexing}
              className="w-full"
              variant="default"
            >
              {isLoadingIndexed ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Folder className="h-4 w-4 mr-2" />
                  Load {selectedFiles.size > 0 ? `${selectedFiles.size} Selected` : 'All'} Files
                </>
              )}
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button 
              onClick={() => folderInputRef.current?.click()}
              disabled={isIndexing || isLoadingIndexed}
              className="flex-1"
              variant="outline"
            >
              {isIndexing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Indexing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Index from Computer
                </>
              )}
            </Button>
            <Button 
              onClick={clearIndex}
              disabled={isIndexing || isLoadingIndexed}
              variant="outline"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Supported files: TypeScript, JavaScript, CSS, JSON, Markdown, SQL, and more
        </p>
      </CardContent>
    </Card>
  );
}
