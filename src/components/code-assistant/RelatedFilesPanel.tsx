import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Link2, ChevronRight, Loader2 } from 'lucide-react';
import { EnhancedFileIcon } from './EnhancedFileIcon';

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
  last_modified: string;
}

interface RelatedFilesPanelProps {
  files: IndexedFile[];
  selectedFileIds: Set<string>;
  onToggleFile: (fileId: string) => void;
}

interface RelatedFile {
  file: IndexedFile;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export function RelatedFilesPanel({ 
  files, 
  selectedFileIds,
  onToggleFile 
}: RelatedFilesPanelProps) {
  const [relatedFiles, setRelatedFiles] = useState<RelatedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (selectedFileIds.size > 0) {
      analyzeRelatedFiles();
    } else {
      setRelatedFiles([]);
    }
  }, [selectedFileIds, files]);

  const analyzeRelatedFiles = () => {
    setIsAnalyzing(true);
    
    // Get selected files
    const selected = files.filter(f => selectedFileIds.has(f.id));
    const unselected = files.filter(f => !selectedFileIds.has(f.id));
    
    const suggestions: RelatedFile[] = [];
    
    // Extract imports from selected files
    const importedPaths = new Set<string>();
    selected.forEach(file => {
      const importMatches = file.file_content.matchAll(
        /(?:import|from)\s+['"]([^'"]+)['"]/g
      );
      for (const match of importMatches) {
        const importPath = match[1];
        // Convert relative imports to potential file paths
        if (importPath.startsWith('.') || importPath.startsWith('@/')) {
          const normalized = importPath.replace('@/', 'src/');
          importedPaths.add(normalized);
        }
      }
    });
    
    // Find files that match imports
    unselected.forEach(file => {
      for (const importPath of importedPaths) {
        if (file.file_path.includes(importPath) || 
            importPath.includes(file.file_path.replace(/\.(tsx?|jsx?)$/, ''))) {
          suggestions.push({
            file,
            reason: 'Imported by selected files',
            confidence: 'high'
          });
          return;
        }
      }
    });
    
    // Find files in same directory
    const selectedDirs = new Set(selected.map(f => f.file_path.split('/').slice(0, -1).join('/')));
    unselected.forEach(file => {
      const fileDir = file.file_path.split('/').slice(0, -1).join('/');
      if (selectedDirs.has(fileDir) && !suggestions.find(s => s.file.id === file.id)) {
        suggestions.push({
          file,
          reason: 'Same directory',
          confidence: 'medium'
        });
      }
    });
    
    // Find test files for selected files
    selected.forEach(selectedFile => {
      const baseName = selectedFile.file_path.replace(/\.(tsx?|jsx?)$/, '');
      const testPatterns = [
        `${baseName}.test.ts`,
        `${baseName}.test.tsx`,
        `${baseName}.spec.ts`,
        `${baseName}.spec.tsx`,
      ];
      
      unselected.forEach(file => {
        if (testPatterns.some(pattern => file.file_path.includes(pattern)) && 
            !suggestions.find(s => s.file.id === file.id)) {
          suggestions.push({
            file,
            reason: 'Test file',
            confidence: 'high'
          });
        }
      });
    });
    
    // Find files that import selected files (reverse dependency)
    const selectedPaths = new Set(selected.map(f => 
      f.file_path.replace(/\.(tsx?|jsx?)$/, '').replace('src/', '@/')
    ));
    
    unselected.forEach(file => {
      const hasImport = Array.from(selectedPaths).some(path => 
        file.file_content.includes(path)
      );
      if (hasImport && !suggestions.find(s => s.file.id === file.id)) {
        suggestions.push({
          file,
          reason: 'Depends on selected files',
          confidence: 'high'
        });
      }
    });
    
    // Sort by confidence
    const sorted = suggestions.sort((a, b) => {
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });
    
    setRelatedFiles(sorted.slice(0, 10)); // Top 10 suggestions
    setIsAnalyzing(false);
  };

  if (selectedFileIds.size === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select files to see smart suggestions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Smart Suggestions</CardTitle>
          </div>
          {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <CardDescription className="text-xs">
          Files related to your selection
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {relatedFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No related files found
          </p>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-1">
              {relatedFiles.map(({ file, reason, confidence }) => {
                const isSelected = selectedFileIds.has(file.id);
                return (
                  <button
                    key={file.id}
                    onClick={() => onToggleFile(file.id)}
                    className={`w-full text-left p-2 rounded-md transition-colors hover:bg-accent/50 ${
                      isSelected ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <EnhancedFileIcon 
                        filePath={file.file_path} 
                        language={file.language} 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {file.file_path.split('/').pop()}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge 
                            variant={confidence === 'high' ? 'default' : 'secondary'}
                            className="text-xs h-4 px-1"
                          >
                            <Link2 className="h-2.5 w-2.5 mr-1" />
                            {reason}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 transition-transform ${
                        isSelected ? 'rotate-90' : ''
                      }`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
