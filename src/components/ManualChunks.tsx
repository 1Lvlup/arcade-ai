import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database, Search } from 'lucide-react';

interface Chunk {
  id: string;
  content: string;
  page_start: number | null;
  page_end: number | null;
  menu_path: string | null;
  created_at: string;
}

interface ManualChunksProps {
  manualId: string;
}

export function ManualChunks({ manualId }: ManualChunksProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredChunks, setFilteredChunks] = useState<Chunk[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchChunks();
  }, [manualId]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = chunks.filter(chunk =>
        chunk.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chunk.menu_path?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredChunks(filtered);
    } else {
      setFilteredChunks(chunks);
    }
  }, [chunks, searchTerm]);

  const fetchChunks = async () => {
    try {
      const { data, error } = await supabase
        .from('chunks_text')
        .select('*')
        .eq('manual_id', manualId)
        .order('page_start', { ascending: true });

      if (error) throw error;
      setChunks(data || []);
    } catch (error) {
      console.error('Error fetching chunks:', error);
      toast({
        title: 'Error loading chunks',
        description: 'Failed to load text chunks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  if (loading) {
    return (
      <Card className="border-primary/30 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-foreground">
            <Database className="h-6 w-6 text-primary" />
            <span>Text Chunks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3 text-foreground">Loading text chunks...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-foreground">
              <Database className="h-6 w-6 text-primary" />
              <span>Text Chunks</span>
              <Badge variant="secondary">{filteredChunks.length}</Badge>
            </CardTitle>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chunks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-input border-primary/30"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredChunks.length === 0 ? (
          <div className="text-center py-12">
            {chunks.length === 0 ? (
              <>
                <Database className="h-16 w-16 mx-auto mb-4 text-primary/50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Text Chunks</h3>
                <p className="text-muted-foreground">
                  No text chunks were processed for this manual yet.
                </p>
              </>
            ) : (
              <>
                <Search className="h-16 w-16 mx-auto mb-4 text-primary/50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Results Found</h3>
                <p className="text-muted-foreground">
                  No chunks match your search term "{searchTerm}".
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredChunks.map((chunk, index) => (
              <Card key={chunk.id} className="border-l-4 border-l-primary hover:shadow-lg transition-shadow bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="text-xs">
                        Chunk {index + 1}
                      </Badge>
                      {chunk.page_start && (
                        <Badge variant="secondary" className="text-xs">
                          {chunk.page_start === chunk.page_end ? 
                            `Page ${chunk.page_start}` : 
                            `Pages ${chunk.page_start}-${chunk.page_end}`
                          }
                        </Badge>
                      )}
                      {chunk.menu_path && (
                        <Badge variant="outline" className="text-xs max-w-48 truncate">
                          {chunk.menu_path}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(chunk.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div 
                    className="text-foreground leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar"
                    dangerouslySetInnerHTML={{
                      __html: highlightSearchTerm(chunk.content, searchTerm)
                    }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}