import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QualityDashboard } from '@/components/QualityDashboard';
import { SharedHeader } from '@/components/SharedHeader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, Calendar, ArrowLeft, Database, Image, Eye } from 'lucide-react';

interface Manual {
  id: string;
  manual_id: string;
  title: string;
  source_filename: string;
  created_at: string;
  updated_at: string;
  job_id?: string;
}

interface Chunk {
  id: string;
  content: string;
  page_start?: number;
  page_end?: number;
  menu_path?: string;
  created_at: string;
}

interface Figure {
  id: string;
  figure_id?: string;
  image_url: string;
  caption_text?: string;
  ocr_text?: string;
  page_number?: number;
  created_at: string;
}

const ManualDetails = () => {
  const { manualId } = useParams<{ manualId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [manual, setManual] = useState<Manual | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [figureUrls, setFigureUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (manualId) {
      fetchManualDetails();
    }
  }, [manualId]);

  const fetchManualDetails = async () => {
    try {
      setLoading(true);

      // Fetch manual details
      const { data: manualData, error: manualError } = await supabase
        .from('documents')
        .select('*')
        .eq('manual_id', manualId)
        .single();

      if (manualError) throw manualError;
      setManual(manualData);

      // Generate signed URL for private storage
      const { data: urlData, error: urlError } = await supabase.storage
        .from('manuals')
        .createSignedUrl(`${manualId}/${manualData.source_filename}`, 3600); // 1 hour expiry
      
      if (!urlError && urlData) {
        setPdfUrl(urlData.signedUrl);
      }

      // Fetch chunks
      const { data: chunksData, error: chunksError } = await supabase
        .from('chunks_text')
        .select('*')
        .eq('manual_id', manualId)
        .order('page_start', { ascending: true });

      if (chunksError) throw chunksError;
      setChunks(chunksData || []);

      // Fetch figures
      const { data: figuresData, error: figuresError } = await supabase
        .from('figures')
        .select('*')
        .eq('manual_id', manualId)
        .order('page_number', { ascending: true });

      if (figuresError) throw figuresError;
      setFigures(figuresData || []);

      // Generate presigned URLs for all figures
      if (figuresData && figuresData.length > 0) {
        const urlPromises = figuresData.map(async (figure) => {
          try {
            const response = await supabase.functions.invoke('presign-image', {
              body: { 
                figure_id: figure.figure_id,
                manual_id: manualId 
              }
            });
            
            if (response.data?.presigned_url) {
              return { id: figure.id, url: response.data.presigned_url };
            }
          } catch (error) {
            console.error(`Failed to get presigned URL for figure ${figure.figure_id}:`, error);
          }
          return null;
        });

        const urlResults = await Promise.all(urlPromises);
        const urlMap: Record<string, string> = {};
        
        urlResults.forEach((result) => {
          if (result) {
            urlMap[result.id] = result.url;
          }
        });
        
        setFigureUrls(urlMap);
      }

    } catch (error) {
      console.error('Error fetching manual details:', error);
      toast({
        title: 'Error loading manual',
        description: 'Failed to load manual details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen arcade-bg">
        <SharedHeader title="Manual Details" showBackButton={true} />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3 text-muted-foreground">Loading manual details...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!manual) {
    return (
      <div className="min-h-screen arcade-bg">
        <SharedHeader title="Manual Not Found" showBackButton={true} />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">Manual not found</h2>
              <p className="text-muted-foreground mb-4">The requested manual could not be found.</p>
              <Button onClick={() => navigate('/manuals')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Manuals
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen arcade-bg">
      <SharedHeader title={manual.title || manual.source_filename} showBackButton={true} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Manual Info Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>{manual.title || manual.source_filename}</span>
                </CardTitle>
                <CardDescription className="mt-2">
                  <div className="flex items-center space-x-4 text-sm">
                    <span>File: {manual.source_filename}</span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>Uploaded: {formatDate(manual.created_at)}</span>
                    </span>
                  </div>
                  <div className="text-xs mt-1 text-muted-foreground">
                    Manual ID: {manual.manual_id}
                  </div>
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="default" className="flex items-center space-x-1">
                  <Database className="h-3 w-3" />
                  <span>{chunks.length} chunks</span>
                </Badge>
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Image className="h-3 w-3" />
                  <span>{figures.length} figures</span>
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs for different views */}
        <Tabs defaultValue="original" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quality" className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Quality Check</span>
            </TabsTrigger>
            <TabsTrigger value="original" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Original PDF</span>
            </TabsTrigger>
            <TabsTrigger value="chunks" className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Text Chunks ({chunks.length})</span>
            </TabsTrigger>
            <TabsTrigger value="figures" className="flex items-center space-x-2">
              <Image className="h-4 w-4" />
              <span>Figures ({figures.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quality" className="mt-6">
            <QualityDashboard 
              manual_id={manual.manual_id} 
              manual_title={manual.title || manual.source_filename} 
            />
          </TabsContent>

          <TabsContent value="original" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Original PDF</CardTitle>
                <CardDescription>
                  View the original manual as uploaded
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pdfUrl ? (
                  <div className="w-full h-[800px] border rounded-lg overflow-hidden">
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full"
                      title={`PDF: ${manual.title}`}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>PDF not available for viewing</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chunks" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Parsed Text Chunks</CardTitle>
                <CardDescription>
                  Text content extracted and chunked for AI processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chunks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No text chunks available</p>
                    <p className="text-sm">Manual may still be processing</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {chunks.map((chunk, index) => (
                      <Card key={chunk.id} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">
                              Chunk #{index + 1}
                            </CardTitle>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              {chunk.page_start && (
                                <Badge variant="outline" className="text-xs">
                                  Page {chunk.page_start}
                                  {chunk.page_end && chunk.page_end !== chunk.page_start && `-${chunk.page_end}`}
                                </Badge>
                              )}
                              {chunk.menu_path && (
                                <Badge variant="secondary" className="text-xs max-w-[200px] truncate">
                                  {chunk.menu_path}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto bg-muted/30 p-3 rounded border">
                            {chunk.content}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="figures" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Extracted Figures</CardTitle>
                <CardDescription>
                  Images and diagrams extracted from the manual
                </CardDescription>
              </CardHeader>
              <CardContent>
                {figures.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No figures extracted</p>
                    <p className="text-sm">This manual may not contain images or diagrams</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                    {figures.map((figure, index) => (
                      <Card key={figure.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Figure #{index + 1}</CardTitle>
                          {figure.page_number && (
                            <Badge variant="outline" className="text-xs w-fit">
                              Page {figure.page_number}
                            </Badge>
                          )}
                        </CardHeader>
                         <CardContent className="space-y-2">
                           <div className="aspect-video bg-muted rounded overflow-hidden">
                             {figureUrls[figure.id] ? (
                               <img
                                 src={figureUrls[figure.id]}
                                 alt={figure.caption_text || `Figure ${index + 1}`}
                                 className="w-full h-full object-contain"
                                 onError={(e) => {
                                   e.currentTarget.src = '/placeholder.svg';
                                 }}
                               />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                 <div className="text-center">
                                   <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                   <p className="text-sm">Loading image...</p>
                                 </div>
                               </div>
                             )}
                           </div>
                          {figure.caption_text && (
                            <div className="text-xs text-muted-foreground">
                              <strong>Caption:</strong> {figure.caption_text}
                            </div>
                          )}
                          {figure.ocr_text && (
                            <div className="text-xs text-muted-foreground">
                              <strong>OCR Text:</strong> {figure.ocr_text}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ManualDetails;