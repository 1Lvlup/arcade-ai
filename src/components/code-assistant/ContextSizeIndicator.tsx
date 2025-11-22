import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { parseFileIntoChunks } from '@/lib/codeParser';

interface ContextSizeIndicatorProps {
  selectedFiles: Array<{
    id: string;
    file_path: string;
    file_content: string;
    language: string | null;
  }>;
  chunkSelections: Map<string, Set<string>>;
}

export function ContextSizeIndicator({ selectedFiles, chunkSelections }: ContextSizeIndicatorProps) {
  const calculateContextSize = () => {
    let totalChars = 0;
    let totalChunks = 0;
    
    selectedFiles.forEach(file => {
      const selectedChunkIds = chunkSelections.get(file.id);
      
      if (selectedChunkIds && selectedChunkIds.size > 0) {
        const chunks = parseFileIntoChunks(file.file_path, file.file_content);
        const selectedChunks = chunks.filter(c => selectedChunkIds.has(c.id));
        
        selectedChunks.forEach(chunk => {
          totalChars += chunk.content.length;
          totalChunks++;
        });
      } else {
        // Whole file selected
        totalChars += file.file_content.length;
        totalChunks++;
      }
    });
    
    return { totalChars, totalChunks, estimatedTokens: Math.ceil(totalChars / 4) };
  };
  
  const { totalChars, totalChunks, estimatedTokens } = calculateContextSize();
  
  if (selectedFiles.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4" />
        <span>No files selected</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <Info className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-2">
        <Badge variant="outline">
          {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}
        </Badge>
        <Badge variant="outline">
          {totalChunks} {totalChunks === 1 ? 'chunk' : 'chunks'}
        </Badge>
        <Badge variant="outline">
          ~{estimatedTokens.toLocaleString()} tokens
        </Badge>
      </div>
    </div>
  );
}
