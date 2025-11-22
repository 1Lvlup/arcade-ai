import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, CheckSquare, Square, FunctionSquare, Box, Braces, FileCode, Import, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { parseFileIntoChunks, CodeChunk } from '@/lib/codeParser';
import { cn } from '@/lib/utils';

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
  last_modified: string;
}

interface FileChunkSelectorProps {
  files: IndexedFile[];
  selectedFileIds: string[];
  chunkSelections: Map<string, Set<string>>; // fileId -> Set of chunkIds
  onChunkSelectionChange: (fileId: string, chunkIds: Set<string>) => void;
}

const chunkTypeIcons: Record<string, React.ReactNode> = {
  import: <Import className="h-3 w-3" />,
  function: <FunctionSquare className="h-3 w-3" />,
  class: <Box className="h-3 w-3" />,
  component: <FileCode className="h-3 w-3" />,
  hook: <CircleDot className="h-3 w-3" />,
  interface: <Braces className="h-3 w-3" />,
  type: <Braces className="h-3 w-3" />,
  const: <CircleDot className="h-3 w-3" />,
  other: <FileCode className="h-3 w-3" />
};

const chunkTypeColors: Record<string, string> = {
  import: 'text-blue-500',
  function: 'text-purple-500',
  class: 'text-orange-500',
  component: 'text-green-500',
  hook: 'text-cyan-500',
  interface: 'text-pink-500',
  type: 'text-pink-400',
  const: 'text-yellow-500',
  other: 'text-muted-foreground'
};

export function FileChunkSelector({
  files,
  selectedFileIds,
  chunkSelections,
  onChunkSelectionChange
}: FileChunkSelectorProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Parse all selected files into chunks
  const fileChunks = useMemo(() => {
    const map = new Map<string, CodeChunk[]>();
    files.forEach(file => {
      if (selectedFileIds.includes(file.id)) {
        const chunks = parseFileIntoChunks(file.file_path, file.file_content);
        map.set(file.id, chunks);
      }
    });
    return map;
  }, [files, selectedFileIds]);

  const toggleFileExpanded = (fileId: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  };

  const toggleChunk = (fileId: string, chunkId: string) => {
    const currentSelections = chunkSelections.get(fileId) || new Set();
    const newSelections = new Set(currentSelections);
    
    if (newSelections.has(chunkId)) {
      newSelections.delete(chunkId);
    } else {
      newSelections.add(chunkId);
    }
    
    onChunkSelectionChange(fileId, newSelections);
  };

  const selectAllChunks = (fileId: string, select: boolean) => {
    const chunks = fileChunks.get(fileId) || [];
    const newSelections = select ? new Set(chunks.map(c => c.id)) : new Set<string>();
    onChunkSelectionChange(fileId, newSelections);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getFileStats = (fileId: string) => {
    const chunks = fileChunks.get(fileId) || [];
    const selectedChunkIds = chunkSelections.get(fileId) || new Set();
    const selectedChunks = chunks.filter(c => selectedChunkIds.has(c.id));
    
    const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
    const selectedSize = selectedChunks.reduce((sum, c) => sum + c.size, 0);
    
    return {
      totalChunks: chunks.length,
      selectedChunks: selectedChunks.length,
      totalSize,
      selectedSize
    };
  };

  if (selectedFileIds.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Select files to see their chunks
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-2">
        {files
          .filter(file => selectedFileIds.includes(file.id))
          .map(file => {
            const chunks = fileChunks.get(file.id) || [];
            const stats = getFileStats(file.id);
            const isExpanded = expandedFiles.has(file.id);
            const selectedChunkIds = chunkSelections.get(file.id) || new Set();
            const allSelected = chunks.length > 0 && selectedChunkIds.size === chunks.length;
            const someSelected = selectedChunkIds.size > 0 && !allSelected;

            return (
              <Collapsible
                key={file.id}
                open={isExpanded}
                onOpenChange={() => toggleFileExpanded(file.id)}
                className="border rounded-lg bg-card"
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center gap-2 p-3 hover:bg-accent/50 transition-colors">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAllChunks(file.id, !allSelected);
                      }}
                    >
                      {allSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : someSelected ? (
                        <Square className="h-4 w-4 text-primary opacity-50" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>

                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium truncate">
                        {file.file_path.split('/').pop()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats.selectedChunks}/{stats.totalChunks} chunks • {formatSize(stats.selectedSize)}/{formatSize(stats.totalSize)}
                      </div>
                    </div>

                    <Badge variant="secondary" className="shrink-0">
                      {Math.round((stats.selectedSize / stats.totalSize) * 100) || 0}%
                    </Badge>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        {chunks.length} chunks available
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => selectAllChunks(file.id, true)}
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => selectAllChunks(file.id, false)}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    {chunks.map(chunk => {
                      const isSelected = selectedChunkIds.has(chunk.id);
                      return (
                        <div
                          key={chunk.id}
                          onClick={() => toggleChunk(file.id, chunk.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent/50 transition-colors",
                            isSelected && "bg-accent"
                          )}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0" />
                          )}

                          <div className={cn("shrink-0", chunkTypeColors[chunk.type])}>
                            {chunkTypeIcons[chunk.type]}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {chunk.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Lines {chunk.startLine}-{chunk.endLine} • {chunk.type}
                            </div>
                          </div>

                          <Badge variant="outline" className="shrink-0 text-xs">
                            {formatSize(chunk.size)}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
      </div>
    </ScrollArea>
  );
}
