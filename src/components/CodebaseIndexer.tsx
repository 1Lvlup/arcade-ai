import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Folder, Trash2, Loader2, FileCode, CheckSquare, Square, RefreshCw, Clock, Github } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface CodebaseIndexerProps {
  onIndexComplete?: () => void;
}

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
  last_modified: string;
}

interface SyncResult {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
}

export function CodebaseIndexer({ onIndexComplete }: CodebaseIndexerProps) {
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingGitHub, setIsSyncingGitHub] = useState(false);
  const [isLoadingIndexed, setIsLoadingIndexed] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [progress, setProgress] = useState(0);
  const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showFileList, setShowFileList] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [dirHandle, setDirHandle] = useState<any>(null);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [gitHubRepo, setGitHubRepo] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadIndexedFilesList();
  }, []);

  // Auto-sync effect
  useEffect(() => {
    if (autoSyncEnabled && dirHandle) {
      console.log('Starting auto-sync with 60s interval');
      
      // Initial sync
      performBackgroundSync();
      
      // Set up periodic sync every 60 seconds
      syncIntervalRef.current = setInterval(() => {
        performBackgroundSync();
      }, 60000);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      };
    } else {
      // Clean up interval when auto-sync is disabled
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    }
  }, [autoSyncEnabled, dirHandle]);

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

  const generateFileHash = (content: string): string => {
    // Simple hash function for content comparison
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  };

  const detectLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'css': 'css',
      'html': 'html',
      'json': 'json',
      'md': 'markdown',
      'sql': 'sql',
      'toml': 'toml',
      'yaml': 'yaml',
      'yml': 'yaml',
    };
    return langMap[ext || ''] || 'text';
  };

  const syncFromGitHub = async () => {
    if (!gitHubRepo.trim()) {
      toast({
        title: "Repository Required",
        description: "Please enter a GitHub repository",
        variant: "destructive",
      });
      return;
    }

    setIsSyncingGitHub(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-github-repo', {
        body: { repository: gitHubRepo.trim() },
      });
      
      if (error) throw error;
      
      if (!data?.files || data.files.length === 0) {
        toast({
          title: "No Files Found",
          description: "No indexable files found in repository",
          variant: "destructive",
        });
        return;
      }

      // Insert files into indexed_codebase
      const filesToInsert = data.files.map((file: any) => ({
        file_path: file.path,
        file_content: file.content,
        language: file.language,
        last_modified: file.last_modified,
      }));

      const { error: insertError } = await supabase
        .from('indexed_codebase')
        .upsert(filesToInsert);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: `Indexed ${data.files.length} files from ${gitHubRepo}${data.skipped ? ` (skipped: ${data.skipped.too_large} too large, ${data.skipped.fetch_failed} failed, ${data.skipped.filtered} filtered)` : ''}`,
      });

      await loadIndexedFilesList();
      setShowGitHubDialog(false);
      setGitHubRepo('');
      if (onIndexComplete) onIndexComplete();
    } catch (error: any) {
      console.error('GitHub sync error:', error);
      toast({
        title: "GitHub Sync Failed",
        description: error.message || "Failed to sync repository",
        variant: "destructive",
      });
    } finally {
      setIsSyncingGitHub(false);
    }
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
        
        if (shouldIndexFile(path) && file.size <= 2000000) { // Increased to 2MB limit
          try {
            const content = await file.text();
            filesToIndex.push({ 
              path, 
              content,
              language: detectLanguage(path)
            });
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

      // Get current user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Insert files directly to database in smaller batches
      const batchSize = 10;
      let processed = 0;

      for (let i = 0; i < filesToIndex.length; i += batchSize) {
        const batch = filesToIndex.slice(i, i + batchSize);
        
        const filesToInsert = batch.map(file => ({
          fec_tenant_id: profile.fec_tenant_id,
          file_path: file.path,
          file_content: file.content,
          language: file.language,
        }));

        const { error } = await supabase
          .from('indexed_codebase')
          .insert(filesToInsert);

        if (error) {
          console.error('Batch insert error:', error);
          // Continue with next batch even if one fails
        }

        processed += batch.length;
        setIndexedCount(processed);
        setProgress((processed / filesToIndex.length) * 100);
      }

      await loadIndexedFilesList();

      toast({ 
        title: 'Success!', 
        description: `Indexed ${processed} files from your codebase` 
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
        .select('id, file_path, file_content, language, last_modified')
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

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get active conversation
      const { data: conversations } = await supabase
        .from('code_assistant_conversations')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!conversations || conversations.length === 0) {
        throw new Error('No active conversation found. Please create a conversation first.');
      }

      const conversationId = conversations[0].id;

      // Insert files into code_assistant_files table
      const filesToInsert = filesToLoad.map(file => ({
        conversation_id: conversationId,
        file_path: file.file_path,
        file_content: file.file_content,
        language: file.language,
      }));

      const { error } = await supabase
        .from('code_assistant_files')
        .insert(filesToInsert);

      if (error) throw error;

      toast({ 
        title: 'Success', 
        description: `Loaded ${filesToLoad.length} file(s) into conversation` 
      });

      onIndexComplete?.();
      setSelectedFiles(new Set());
    } catch (error: any) {
      console.error('Error loading indexed files:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to load indexed files',
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

  const performBackgroundSync = async () => {
    if (!dirHandle || isSyncing) return;

    console.log('🔄 Performing background sync...');
    setIsSyncing(true);

    try {
      // Read all files from stored directory handle
      const newFiles: any[] = [];
      await readDirectoryRecursive(dirHandle, '', newFiles);

      // Get current indexed files
      const { data: currentFiles, error: fetchError } = await supabase
        .from('indexed_codebase')
        .select('*');

      if (fetchError) throw fetchError;

      const currentFilesMap = new Map(
        (currentFiles || []).map(f => [f.file_path, f])
      );

      // Get current user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      let added = 0;
      let updated = 0;
      const updatedFilePaths: string[] = [];

      // Process files
      for (const newFile of newFiles) {
        const existing = currentFilesMap.get(newFile.path);
        const newHash = generateFileHash(newFile.content);
        
        if (!existing) {
          // New file - insert
          await supabase.from('indexed_codebase').insert({
            fec_tenant_id: profile.fec_tenant_id,
            file_path: newFile.path,
            file_content: newFile.content,
            language: detectLanguage(newFile.path),
          });
          added++;
          updatedFilePaths.push(newFile.path);
        } else {
          const existingHash = generateFileHash(existing.file_content);
          if (existingHash !== newHash) {
            // File changed - update indexed_codebase
            await supabase
              .from('indexed_codebase')
              .update({
                file_content: newFile.content,
                last_modified: new Date().toISOString(),
              })
              .eq('id', existing.id);
            
            // Also update code_assistant_files entries
            await supabase
              .from('code_assistant_files')
              .update({
                file_content: newFile.content,
              })
              .eq('file_path', newFile.path);
            
            updated++;
            updatedFilePaths.push(newFile.path);
          }
        }
      }

      // Find removed files
      const newFilePaths = new Set(newFiles.map(f => f.path));
      const removedFiles = (currentFiles || []).filter(
        f => !newFilePaths.has(f.file_path)
      );

      if (removedFiles.length > 0) {
        await supabase
          .from('indexed_codebase')
          .delete()
          .in('id', removedFiles.map(f => f.id));
        
        // Also remove from code_assistant_files
        await supabase
          .from('code_assistant_files')
          .delete()
          .in('file_path', removedFiles.map(f => f.file_path));
      }

      setLastSyncTime(new Date());
      await loadIndexedFilesList();

      // Only show toast if changes were detected
      if (added > 0 || updated > 0 || removedFiles.length > 0) {
        console.log(`✅ Sync complete: ${added} added, ${updated} updated, ${removedFiles.length} removed`);
        toast({ 
          title: 'Auto-sync complete', 
          description: `${added} added, ${updated} updated, ${removedFiles.length} removed`,
        });
      } else {
        console.log('✅ Sync complete: No changes detected');
      }

    } catch (error: any) {
      console.error('Error in background sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncFiles = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    
    try {
      // Check if File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        toast({ 
          title: 'Browser Not Supported', 
          description: 'This feature requires Chrome or Edge browser. Please use a supported browser or manually upload files.',
          variant: 'destructive'
        });
        setIsSyncing(false);
        return;
      }

      // Request directory access
      const newDirHandle = await (window as any).showDirectoryPicker({
        mode: 'read',
      });
      
      // Store directory handle for auto-sync
      setDirHandle(newDirHandle);

      toast({ title: 'Scanning for changes...', description: 'Comparing with indexed files' });

      // Read all files from directory
      const newFiles: any[] = [];
      await readDirectoryRecursive(newDirHandle, '', newFiles);

      // Get current indexed files
      const { data: currentFiles, error: fetchError } = await supabase
        .from('indexed_codebase')
        .select('*');

      if (fetchError) throw fetchError;

      const currentFilesMap = new Map(
        (currentFiles || []).map(f => [f.file_path, f])
      );

      // Get current user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      let added = 0;
      let updated = 0;
      let unchanged = 0;

      // Process files in batches
      const batchSize = 10;
      for (let i = 0; i < newFiles.length; i += batchSize) {
        const batch = newFiles.slice(i, i + batchSize);
        
        for (const newFile of batch) {
          const existing = currentFilesMap.get(newFile.path);
          const newHash = generateFileHash(newFile.content);
          
          if (!existing) {
            // New file - insert
            await supabase.from('indexed_codebase').insert({
              fec_tenant_id: profile.fec_tenant_id,
              file_path: newFile.path,
              file_content: newFile.content,
              language: detectLanguage(newFile.path),
            });
            added++;
          } else {
            const existingHash = generateFileHash(existing.file_content);
            if (existingHash !== newHash) {
              // File changed - update indexed_codebase
              await supabase
                .from('indexed_codebase')
                .update({
                  file_content: newFile.content,
                  last_modified: new Date().toISOString(),
                })
                .eq('id', existing.id);
              
              // Also update code_assistant_files entries
              await supabase
                .from('code_assistant_files')
                .update({
                  file_content: newFile.content,
                })
                .eq('file_path', newFile.path);
              
              updated++;
            } else {
              unchanged++;
            }
          }
        }
        
        setProgress(((i + batch.length) / newFiles.length) * 100);
      }

      // Find removed files
      const newFilePaths = new Set(newFiles.map(f => f.path));
      const removedFiles = (currentFiles || []).filter(
        f => !newFilePaths.has(f.file_path)
      );

      // Optionally remove deleted files
      if (removedFiles.length > 0) {
        await supabase
          .from('indexed_codebase')
          .delete()
          .in('id', removedFiles.map(f => f.id));
        
        // Also remove from code_assistant_files
        await supabase
          .from('code_assistant_files')
          .delete()
          .in('file_path', removedFiles.map(f => f.file_path));
      }

      const result = {
        added,
        updated,
        unchanged,
        removed: removedFiles.length,
      };

      setSyncResult(result);
      setLastSyncTime(new Date());
      await loadIndexedFilesList();

      toast({ 
        title: 'Sync Complete!', 
        description: `${added} added, ${updated} updated, ${removedFiles.length} removed`,
      });

      onIndexComplete?.();
    } catch (error: any) {
      console.error('Error syncing files:', error);
      
      if (error.name === 'SecurityError' || error.message?.includes('user aborted')) {
        toast({ 
          title: 'Cancelled', 
          description: 'Sync was cancelled',
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Error', 
          description: error.message || 'Failed to sync files',
          variant: 'destructive' 
        });
      }
    } finally {
      setIsSyncing(false);
      setProgress(0);
    }
  };

  const readDirectoryRecursive = async (
    dirHandle: any,
    path: string,
    files: any[]
  ) => {
    try {
      // @ts-ignore - File System Access API
      for await (const entry of dirHandle.values()) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;
        
        if (entry.kind === 'file') {
          if (shouldIndexFile(entryPath)) {
            const file = await entry.getFile();
            if (file.size <= 500000) {
              try {
                const content = await file.text();
                files.push({ path: entryPath, content });
              } catch (error) {
                console.warn(`Failed to read ${entryPath}:`, error);
              }
            }
          }
        } else if (entry.kind === 'directory') {
          await readDirectoryRecursive(entry, entryPath, files);
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }
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
            <div className="flex items-center justify-between">
              <p className="font-medium">Current Status: {indexedFiles.length} file(s) indexed</p>
              {indexedFiles.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={syncFiles}
                  disabled={isSyncing || isIndexing}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
              )}
            </div>
            <p className="text-sm">
              {indexedFiles.length === 0 
                ? 'Upload files from your computer to build your indexed codebase. Then you can selectively load them into conversations.'
                : 'Select files below to load into the conversation, sync to update, or upload more files.'}
            </p>
          </AlertDescription>
        </Alert>

        {dirHandle && (
          <Alert className="border-primary/20 bg-primary/5">
            <AlertDescription className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <p className="font-medium">Auto-Sync</p>
                  <Badge variant={autoSyncEnabled ? "default" : "secondary"}>
                    {autoSyncEnabled ? "Active" : "Off"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="auto-sync-toggle" className="text-sm cursor-pointer">
                    Monitor changes (60s)
                  </Label>
                  <Switch
                    id="auto-sync-toggle"
                    checked={autoSyncEnabled}
                    onCheckedChange={setAutoSyncEnabled}
                  />
                </div>
              </div>
              {lastSyncTime && (
                <p className="text-xs text-muted-foreground">
                  Last sync: {lastSyncTime.toLocaleTimeString()}
                </p>
              )}
              {autoSyncEnabled && (
                <p className="text-xs text-muted-foreground">
                  🔄 Auto-sync is monitoring your codebase for changes and will automatically update files in your conversations
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {syncResult && (
          <Alert>
            <AlertDescription>
              <p className="font-medium mb-1">Last Sync Results:</p>
              <div className="text-sm space-y-1">
                <p>✅ {syncResult.added} files added</p>
                <p>🔄 {syncResult.updated} files updated</p>
                <p>📋 {syncResult.unchanged} files unchanged</p>
                {syncResult.removed > 0 && <p>🗑️ {syncResult.removed} files removed</p>}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isSyncing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Syncing files...</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

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
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {file.language} • {(file.file_content.length / 1024).toFixed(1)}KB
                          </p>
                          {file.last_modified && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(file.last_modified).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
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
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => setShowGitHubDialog(true)}
              disabled={isSyncingGitHub || isIndexing || isLoadingIndexed || isSyncing}
              className="flex-1 min-w-[140px]"
              variant="default"
            >
              {isSyncingGitHub ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Github className="h-4 w-4 mr-2" />
                  Sync from GitHub
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => folderInputRef.current?.click()}
              disabled={isIndexing || isLoadingIndexed || isSyncingGitHub || isSyncing}
              className="flex-1 min-w-[140px]"
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
                  From Computer
                </>
              )}
            </Button>
            
            <Button 
              onClick={clearIndex}
              disabled={isIndexing || isLoadingIndexed || isSyncingGitHub || isSyncing}
              variant="outline"
              className="min-w-[100px]"
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

      <Dialog open={showGitHubDialog} onOpenChange={setShowGitHubDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync from GitHub</DialogTitle>
            <DialogDescription>
              Enter your GitHub repository to index its files
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="github-repo">Repository</Label>
              <Input
                id="github-repo"
                placeholder="owner/repo (e.g., facebook/react)"
                value={gitHubRepo}
                onChange={(e) => setGitHubRepo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSyncingGitHub) {
                    syncFromGitHub();
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">
                Make sure you've added your GitHub token to Supabase secrets
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGitHubDialog(false);
                setGitHubRepo('');
              }}
              disabled={isSyncingGitHub}
            >
              Cancel
            </Button>
            <Button
              onClick={syncFromGitHub}
              disabled={isSyncingGitHub || !gitHubRepo.trim()}
            >
              {isSyncingGitHub ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                'Sync Repository'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
