import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { SharedHeader } from '@/components/SharedHeader';
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
import { Search, Plus, Edit, Eye, RefreshCw, Database, AlertCircle } from 'lucide-react';
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

  const handleBackfill = async (manualId: string, dryRun: boolean = true) => {
    try {
      const { data, error } = await supabase.rpc('admin_backfill_manual', {
        p_manual_id: manualId,
        p_dry_run: dryRun
      });

      if (error) throw error;

      const result = data as any;
      if (dryRun) {
        const total = (result.would_update_chunks_text || 0) + (result.would_update_rag_chunks || 0);
        toast.info('Dry Run Complete', {
          description: `Would update ${total} chunks (chunks_text: ${result.would_update_chunks_text || 0}, rag_chunks: ${result.would_update_rag_chunks || 0}). Run without dry-run to apply.`
        });
      } else {
        toast.success('Backfill Complete', {
          description: `Updated ${result.total || 0} chunks (chunks_text: ${result.updated_chunks_text || 0}, rag_chunks: ${result.updated_rag_chunks || 0})`
        });
        refetch();
      }
    } catch (error: any) {
      toast.error('Backfill Failed', {
        description: error.message
      });
    }
  };

  const handleReindex = async (manualId: string) => {
    try {
      const { data, error } = await supabase.rpc('trigger_reindex', {
        p_manual_id: manualId
      });

      if (error) throw error;

      toast.success('Reindex Triggered', {
        description: `Manual ${manualId} marked for reindexing.`
      });
      refetch();
    } catch (error: any) {
      toast.error('Reindex Failed', {
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
    <div className="min-h-screen arcade-bg">
      <SharedHeader title="Manual Administration" />
      
      <main className="container mx-auto py-8 px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold neon-text mb-2">Manual Administration</h1>
            <p className="text-muted-foreground">Manage manual metadata and indexing</p>
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManuals?.map((manual) => (
                    <TableRow key={manual.manual_id}>
                      <TableCell className="font-medium">
                        {manual.canonical_title}
                        {manual.requires_reindex && (
                          <AlertCircle className="inline ml-2 h-4 w-4 text-warning" />
                        )}
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/manual-admin/edit/${manual.manual_id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBackfill(manual.manual_id, true)}
                          >
                            <Database className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReindex(manual.manual_id)}
                            disabled={manual.requires_reindex}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
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
      </main>
    </div>
  );
};

export default ManualAdmin;