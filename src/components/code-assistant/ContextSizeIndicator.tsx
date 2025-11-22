import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
  last_modified: string;
}

interface ContextSizeIndicatorProps {
  selectedFiles: IndexedFile[];
  maxSize?: number; // in KB
}

export function ContextSizeIndicator({ selectedFiles, maxSize = 200 }: ContextSizeIndicatorProps) {
  const calculateTotalSize = (): number => {
    let totalBytes = 0;
    selectedFiles.forEach(file => {
      totalBytes += new Blob([file.file_content]).size;
    });
    return totalBytes / 1024; // Convert to KB
  };

  const totalKB = calculateTotalSize();
  const percentage = (totalKB / maxSize) * 100;
  
  const getStatus = () => {
    if (percentage >= 97.5) return 'error'; // 195KB+
    if (percentage >= 75) return 'warning'; // 150KB+
    return 'safe';
  };

  const status = getStatus();

  const getStatusIcon = () => {
    switch (status) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'error':
        return 'bg-destructive';
      case 'warning':
        return 'bg-orange-500';
      default:
        return 'bg-green-500';
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'error':
        return 'Context size too large! Remove files to avoid errors.';
      case 'warning':
        return 'Approaching context limit. Consider removing some files.';
      default:
        return 'Context size is healthy';
    }
  };

  return (
    <div className="p-3 border-t border-border bg-background">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-xs font-medium">
            {totalKB.toFixed(1)}KB / {maxSize}KB
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant={status === 'error' ? 'destructive' : status === 'warning' ? 'secondary' : 'default'}
                className="text-xs cursor-help"
              >
                {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{getStatusMessage()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="relative">
        <Progress 
          value={Math.min(percentage, 100)} 
          className="h-2"
        />
        <div 
          className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getStatusColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      {status !== 'safe' && (
        <p className="text-xs text-muted-foreground mt-1">
          {getStatusMessage()}
        </p>
      )}
    </div>
  );
}
