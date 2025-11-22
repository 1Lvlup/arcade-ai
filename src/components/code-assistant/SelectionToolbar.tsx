import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CheckSquare, Square, Filter, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
  last_modified: string;
}

interface SelectionToolbarProps {
  files: IndexedFile[];
  selectedFileIds: Set<string>;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectByType: (type: string) => void;
  recentlyUsedFiles: string[];
  onSelectRecentFiles: () => void;
}

export function SelectionToolbar({
  files,
  selectedFileIds,
  onSelectAll,
  onDeselectAll,
  onSelectByType,
  recentlyUsedFiles,
  onSelectRecentFiles,
}: SelectionToolbarProps) {
  const allSelected = files.length > 0 && selectedFileIds.size === files.length;
  const someSelected = selectedFileIds.size > 0 && selectedFileIds.size < files.length;

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-muted/30">
      <Button
        variant="outline"
        size="sm"
        onClick={allSelected ? onDeselectAll : onSelectAll}
        className="gap-2 shrink-0"
      >
        {allSelected || someSelected ? (
          <CheckSquare className="h-4 w-4" />
        ) : (
          <Square className="h-4 w-4" />
        )}
        {allSelected ? 'Deselect All' : 'Select All'}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 shrink-0">
            <Filter className="h-4 w-4" />
            By Type
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-background z-50">
          <DropdownMenuItem onClick={() => onSelectByType('typescript')}>
            TypeScript/JavaScript Files
            <Badge variant="secondary" className="ml-auto">
              {files.filter(f => 
                f.language === 'typescript' || 
                f.language === 'javascript' ||
                f.file_path.endsWith('.ts') ||
                f.file_path.endsWith('.tsx') ||
                f.file_path.endsWith('.js') ||
                f.file_path.endsWith('.jsx')
              ).length}
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelectByType('edge-functions')}>
            Edge Functions Only
            <Badge variant="secondary" className="ml-auto">
              {files.filter(f => f.file_path.includes('supabase/functions')).length}
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelectByType('components')}>
            React Components Only
            <Badge variant="secondary" className="ml-auto">
              {files.filter(f => 
                f.file_path.includes('/components/') && 
                (f.file_path.endsWith('.tsx') || f.file_path.endsWith('.jsx'))
              ).length}
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelectByType('migrations')}>
            Database Migrations
            <Badge variant="secondary" className="ml-auto">
              {files.filter(f => f.file_path.includes('migrations')).length}
            </Badge>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {recentlyUsedFiles.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onSelectRecentFiles}
          className="gap-2 shrink-0"
        >
          <Clock className="h-4 w-4" />
          Recent
          <Badge variant="secondary">{recentlyUsedFiles.length}</Badge>
        </Button>
      )}

      <div className="ml-auto text-xs text-muted-foreground shrink-0">
        {selectedFileIds.size} / {files.length} selected
      </div>
    </div>
  );
}
