import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, Plus, Edit, Database, Play, Trash2, Image } from 'lucide-react';
import { toast } from 'sonner';
import { QuickTestConsole } from '@/components/QuickTestConsole';

interface ManualMetadata {
  manual_id: string;
  canonical_title: string;
  canonical_slug: string;
  manufacturer?: string;
  platform?: string;
  doc_type?: string;
  ingest_status?: string;
  uploaded_by?: string;
  upload_date?: string;
  requires_reindex?: boolean;
  tags?: string[];
}

const ManualAdmin = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [backfillDialog, setBackfillDialog] = useState<{
    open: boolean;
    manualId: string;
    manualTitle: string;
    dryRunResult: any;
  }>({
    open: false,
    manualId: '',
    manualTitle: '',
    dryRunResult: null
  });

  const { data: manuals, isLoading, refetch } = useQuery({
    queryKey: ['manual-metadata'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_metadata')
        .select('*')
        .order('canonical_title');
      
      if (error) throw error;
      return data as ManualMetadata[];
    }
  });

  // Check metadata population status for each manual
  const { data: metadataStatus } = useQuery({
    queryKey: ['metadata-status', manuals?.map(m => m.manual_id)],
    queryFn: async () => {
      if (!manuals) return {};
      
      const statusMap: Record<string, { populated: boolean; count: number }> = {};
      
      await Promise.all(manuals.map(async (manual) => {
        const { data: chunks } = await supabase
          .from('chunks_text')
          .select('metadata')
          .eq('manual_id', manual.manual_id)
          .limit(5);
        
        // Check if metadata is populated (has game_title)
        const populated = chunks?.some(c => {
          const metadata = c.metadata as any;
          return metadata && typeof metadata === 'object' && metadata.game_title;
        }) || false;
        
        statusMap[manual.manual_id] = {
          populated,
          count: chunks?.length || 0
        };
      }));
      
      return statusMap;
    },
    enabled: !!manuals
  });

  const handleBackfillPreview = async (manualId: string, manualTitle: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_backfill_manual', {
        p_manual_id: manualId,
        p_dry_run: true
      });

      if (error) throw error;

      setBackfillDialog({
        open: true,
        manualId,
        manualTitle,
        dryRunResult: data
      });
    } catch (error: any) {
      toast.error('Backfill Preview Failed', {
        description: error.message
      });
    }
  };

  const handleBackfillRun = async () => {
    const { manualId, manualTitle } = backfillDialog;
    try {
      const { data, error } = await supabase.rpc('admin_backfill_manual', {
        p_manual_id: manualId,
        p_dry_run: false
      });

      if (error) throw error;

      const result = data as any;
      toast.success('Backfill Complete', {
        description: `Updated ${result.total || 0} chunks for ${manualTitle}`
      });
      
      setBackfillDialog({ open: false, manualId: '', manualTitle: '', dryRunResult: null });
      refetch();
    } catch (error: any) {
      toast.error('Backfill Failed', {
        description: error.message
      });
    }
  };


  const handleDelete = async (manualId: string, manualTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${manualTitle}"? This will remove all associated chunks, figures, and data. This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('delete-manual', {
        body: { manual_id: manualId }
      });

      if (error) throw error;

      toast.success('Manual Deleted', {
        description: `${manualTitle} and all associated data have been removed.`
      });
      refetch();
    } catch (error: any) {
      toast.error('Delete Failed', {
        description: error.message
      });
    }
  };

  const filteredManuals = manuals?.filter(manual => {
    const matchesSearch = 
      manual.canonical_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manual.manual_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manual.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlatform = platformFilter === 'all' || manual.platform === platformFilter;
    const matchesDocType = docTypeFilter === 'all' || manual.doc_type === docTypeFilter;
    
    return matchesSearch && matchesPlatform && matchesDocType;
  });

  const uniquePlatforms = Array.from(new Set(manuals?.map(m => m.platform).filter(Boolean)));
  const uniqueDocTypes = Array.from(new Set(manuals?.map(m => m.doc_type).filter(Boolean)));

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Manual Metadata & Indexing</h2>
          <p className="text-muted-foreground">Manage manual metadata and backfill operations</p>
        </div>
        <Button 
          onClick={() => navigate('/manual-admin/new')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Manual
        </Button>
      </div>

      <Card className="border-primary/20 mb-6">
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>Find and filter manuals</CardDescription>
        </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search manuals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {uniquePlatforms.map(platform => (
                    <SelectItem key={platform} value={platform!}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Document Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Document Types</SelectItem>
                  {uniqueDocTypes.map(docType => (
                    <SelectItem key={docType} value={docType!}>
                      {docType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading manuals...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Metadata</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManuals?.map((manual) => (
                    <TableRow key={manual.manual_id}>
                      <TableCell className="font-medium">
                        {manual.canonical_title}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {manual.canonical_slug}
                        </code>
                      </TableCell>
                      <TableCell>{manual.platform || '-'}</TableCell>
                      <TableCell>{manual.doc_type || '-'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={manual.ingest_status === 'ingested' ? 'default' : 'secondary'}
                        >
                          {manual.ingest_status || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {metadataStatus?.[manual.manual_id] ? (
                          metadataStatus[manual.manual_id].populated ? (
                            <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
                              ✓ Populated
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                              ⚠ Not Populated
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline">
                            Checking...
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <div className="flex justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/manual-admin/edit/${manual.manual_id}`)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit metadata</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleBackfillPreview(manual.manual_id, manual.canonical_title)}
                                >
                                  <Database className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="max-w-xs">
                                  <p className="font-semibold">Populate Metadata</p>
                                  <p className="text-xs">Updates chunk metadata with game title, platform, etc.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      toast.loading(`Backfilling figure types for ${manual.canonical_title}...`);
                                      const { data, error } = await supabase.functions.invoke('backfill-figure-types', {
                                        body: { manual_id: manual.manual_id }
                                      });
                                      
                                      if (error) throw error;
                                      
                                      toast.dismiss();
                                      toast.success(`Processed ${data.processed}/${data.total} figures`, {
                                        description: data.errors ? `${data.errors} errors occurred` : 'All figures updated'
                                      });
                                    } catch (error: any) {
                                      toast.dismiss();
                                      toast.error('Backfill failed', {
                                        description: error.message
                                      });
                                    }
                                  }}
                                >
                                  <Image className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="max-w-xs">
                                  <p className="font-semibold">Backfill Figure Types</p>
                                  <p className="text-xs">Extract figure_type metadata from existing images</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(manual.manual_id, manual.canonical_title)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete manual and all data</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <QuickTestConsole />
      </div>

      <Dialog open={backfillDialog.open} onOpenChange={(open) => 
        setBackfillDialog({ ...backfillDialog, open })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Populate Metadata for {backfillDialog.manualTitle}</DialogTitle>
            <DialogDescription>
              This will update chunk metadata with game title, platform, manufacturer, and other fields from manual_metadata.
            </DialogDescription>
          </DialogHeader>
          
          {backfillDialog.dryRunResult && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h4 className="font-semibold mb-2">Preview:</h4>
                <div className="space-y-1 text-sm">
                  <p>• Would update <strong>{backfillDialog.dryRunResult.would_update_chunks_text || 0}</strong> chunks in chunks_text</p>
                  <p>• Would update <strong>{backfillDialog.dryRunResult.would_update_rag_chunks || 0}</strong> chunks in rag_chunks</p>
                  <p className="font-semibold mt-2">Total: {backfillDialog.dryRunResult.would_update_total || 0} chunks</p>
                </div>
              </div>
              
              {backfillDialog.dryRunResult.metadata_preview && (
                <div className="rounded-lg border p-4">
                  <h4 className="font-semibold mb-2 text-sm">Metadata to be added:</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(backfillDialog.dryRunResult.metadata_preview, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => 
              setBackfillDialog({ open: false, manualId: '', manualTitle: '', dryRunResult: null })
            }>
              Cancel
            </Button>
            <Button onClick={handleBackfillRun}>
              <Play className="mr-2 h-4 w-4" />
              Run Backfill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManualAdmin;