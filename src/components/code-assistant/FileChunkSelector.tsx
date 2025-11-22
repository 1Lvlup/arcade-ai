import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Code } from 'lucide-react';
import { parseFileIntoChunks } from '@/lib/codeParser';

interface FileChunkSelectorProps {
  files: Array<{
    id: string;
    file_path: string;
    file_content: string;
    language: string | null;
  }>;
  selectedFileIds: string[];
  chunkSelections: Map<string, Set<string>>;
  onChunkSelectionChange: (fileId: string, chunkIds: Set<string>) => void;
}

export function FileChunkSelector({
  files,
  selectedFileIds,
  chunkSelections,
  onChunkSelectionChange,
}: FileChunkSelectorProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const selectedFiles = files.filter(f => selectedFileIds.includes(f.id));

  const toggleFile = (fileId: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  };

  const toggleChunk = (fileId: string, chunkId: string) => {
    const currentSelection = chunkSelections.get(fileId) || new Set<string>();
    const newSelection = new Set(currentSelection);
    
    if (newSelection.has(chunkId)) {
      newSelection.delete(chunkId);
    } else {
      newSelection.add(chunkId);
    }
    
    onChunkSelectionChange(fileId, newSelection);
  };

  const toggleAllChunks = (fileId: string, allChunkIds: string[]) => {
    const currentSelection = chunkSelections.get(fileId) || new Set<string>();
    const allSelected = allChunkIds.every(id => currentSelection.has(id));
    
    if (allSelected) {
      onChunkSelectionChange(fileId, new Set());
    } else {
      onChunkSelectionChange(fileId, new Set(allChunkIds));
    }
  };

  if (selectedFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Code className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          Select files from the Files tab to choose specific chunks
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full px-3">
      <div className="space-y-2">
        {selectedFiles.map(file => {
          const chunks = parseFileIntoChunks(file.file_path, file.file_content);
          const isExpanded = expandedFiles.has(file.id);
          const selectedChunks = chunkSelections.get(file.id) || new Set<string>();
          const allChunkIds = chunks.map(c => c.id);
          const allSelected = allChunkIds.length > 0 && allChunkIds.every(id => selectedChunks.has(id));
          const someSelected = allChunkIds.some(id => selectedChunks.has(id));

          return (
            <Collapsible
              key={file.id}
              open={isExpanded}
              onOpenChange={() => toggleFile(file.id)}
            >
              <div className="border rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <button className="p-1 hover:bg-accent rounded">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => toggleAllChunks(file.id, allChunkIds)}
                    className={someSelected && !allSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.file_path}</p>
                  </div>
                  
                  <Badge variant="secondary" className="text-xs">
                    {selectedChunks.size}/{chunks.length}
                  </Badge>
                </div>

                <CollapsibleContent>
                  <div className="mt-2 ml-8 space-y-1">
                    {chunks.map(chunk => (
                      <div
                        key={chunk.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                        onClick={() => toggleChunk(file.id, chunk.id)}
                      >
                        <Checkbox
                          checked={selectedChunks.has(chunk.id)}
                          onCheckedChange={() => toggleChunk(file.id, chunk.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{chunk.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Lines {chunk.startLine}-{chunk.endLine}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </ScrollArea>
  );
}
