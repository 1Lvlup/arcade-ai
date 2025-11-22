import { X, FileCode, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
  last_modified: string;
}

interface FilePreviewPanelProps {
  file: IndexedFile | null;
  isSelected: boolean;
  onClose: () => void;
  onToggleSelection: () => void;
}

export function FilePreviewPanel({ file, isSelected, onClose, onToggleSelection }: FilePreviewPanelProps) {
  if (!file) return null;

  const getFileSize = (content: string): string => {
    const bytes = new Blob([content]).size;
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getLineCount = (content: string): number => {
    return content.split('\n').length;
  };

  const getPreviewLines = (content: string): string => {
    const lines = content.split('\n');
    return lines.slice(0, 50).join('\n');
  };

  const previewContent = getPreviewLines(file.file_content);
  const totalLines = getLineCount(file.file_content);
  const showingLines = Math.min(50, totalLines);

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[500px] bg-background border-l border-border shadow-lg z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.file_path.split('/').pop()}</p>
            <p className="text-xs text-muted-foreground truncate">{file.file_path}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
        <Badge variant="secondary" className="text-xs">
          {file.language || 'text'}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {getFileSize(file.file_content)}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {totalLines} lines
        </Badge>
      </div>

      {/* Action Button */}
      <div className="px-4 py-3 border-b border-border">
        <Button
          variant={isSelected ? "destructive" : "default"}
          size="sm"
          className="w-full"
          onClick={onToggleSelection}
        >
          {isSelected ? (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Context
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add to Context
            </>
          )}
        </Button>
      </div>

      {/* Preview */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing first {showingLines} of {totalLines} lines
            </p>
            {totalLines > 50 && (
              <p className="text-xs text-muted-foreground">
                Select file to view full content in conversation
              </p>
            )}
          </div>
          <div className="rounded-md overflow-hidden border border-border">
            <SyntaxHighlighter
              language={file.language || 'text'}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                fontSize: '12px',
                lineHeight: '1.5',
              }}
              showLineNumbers
            >
              {previewContent}
            </SyntaxHighlighter>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
