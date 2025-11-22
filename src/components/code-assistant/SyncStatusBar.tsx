import { Github, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface SyncStatusBarProps {
  repository: string | null;
  branch: string;
  lastSync: Date | null;
  isSyncing: boolean;
  syncError: string | null;
  fileCount: number;
  onSync: () => void;
}

export function SyncStatusBar({
  repository,
  branch,
  lastSync,
  isSyncing,
  syncError,
  fileCount,
  onSync,
}: SyncStatusBarProps) {
  const getStatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin text-primary" />;
    }
    if (syncError) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    if (lastSync) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (isSyncing) return 'Syncing...';
    if (syncError) return 'Sync failed';
    if (lastSync) return `Synced ${formatDistanceToNow(lastSync, { addSuffix: true })}`;
    return 'Not synced';
  };

  if (!repository) {
    return (
      <div className="border-b bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Github className="h-4 w-4" />
          <span>No repository connected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{repository}</span>
            <Badge variant="outline" className="text-xs">{branch}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>
          <span className="text-muted-foreground">
            {fileCount} {fileCount === 1 ? 'file' : 'files'} indexed
          </span>
        </div>

        {syncError && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
            {syncError}
          </div>
        )}
      </div>
    </div>
  );
}
