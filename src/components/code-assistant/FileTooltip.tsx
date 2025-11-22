import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Clock, FileCode, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
  last_modified: string;
}

interface FileTooltipProps {
  file: IndexedFile;
  children: React.ReactNode;
}

export function FileTooltip({ file, children }: FileTooltipProps) {
  const lines = file.file_content.split('\n').length;
  const chars = file.file_content.length;
  const sizeKB = (chars / 1024).toFixed(1);
  const modifiedAgo = formatDistanceToNow(new Date(file.last_modified), { addSuffix: true });
  
  const isRecent = new Date().getTime() - new Date(file.last_modified).getTime() < 24 * 60 * 60 * 1000; // 24h
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-sm bg-background border shadow-lg">
          <div className="space-y-2">
            <div className="font-medium text-sm truncate max-w-xs">
              {file.file_path}
            </div>
            
            <div className="flex flex-wrap gap-2 text-xs">
              {file.language && (
                <Badge variant="secondary" className="gap-1">
                  <FileCode className="h-3 w-3" />
                  {file.language}
                </Badge>
              )}
              <Badge variant="outline">{lines} lines</Badge>
              <Badge variant="outline">{sizeKB} KB</Badge>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Modified {modifiedAgo}</span>
              {isRecent && (
                <Badge variant="default" className="text-xs">Recent</Badge>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
