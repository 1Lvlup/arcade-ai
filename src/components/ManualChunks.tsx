import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database, Search, FileText, BookOpen } from 'lucide-react';

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

  const truncateContent = (content: string, maxLength: number = 300) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  if (loading) {
    return (
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-900">
            <Database className="h-6 w-6" />
            <span>Text Chunks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-3 text-gray-600">Loading text chunks...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-blue-900">
              <Database className="h-6 w-6" />
              <span>Text Chunks</span>
              <Badge variant="secondary">{filteredChunks.length}</Badge>
            </CardTitle>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search chunks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredChunks.length === 0 ? (
          <div className="text-center py-12">
            {chunks.length === 0 ? (
              <>
                <Database className="h-16 w-16 mx-auto mb-4 text-blue-300" />
                <h3 className="text-xl font-semibold text-blue-900 mb-2">No Text Chunks</h3>
                <p className="text-blue-600">
                  No text chunks were processed for this manual yet.
                </p>
              </>
            ) : (
              <>
                <Search className="h-16 w-16 mx-auto mb-4 text-blue-300" />
                <h3 className="text-xl font-semibold text-blue-900 mb-2">No Results Found</h3>
                <p className="text-blue-600">
                  No chunks match your search term "{searchTerm}".
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredChunks.map((chunk, index) => (
              <Card key={chunk.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
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
                    <div className="text-xs text-gray-500">
                      {new Date(chunk.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div 
                    className="text-gray-800 leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: highlightSearchTerm(truncateContent(chunk.content), searchTerm)
                    }}
                  />
                  
                  {chunk.content.length > 300 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-3 text-blue-600"
                      onClick={() => {
                        // TODO: Show full content in a modal or expand in place
                        toast({
                          title: 'Full content',
                          description: 'Full content viewing will be implemented soon',
                        });
                      }}
                    >
                      <BookOpen className="h-4 w-4 mr-1" />
                      Read More
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}