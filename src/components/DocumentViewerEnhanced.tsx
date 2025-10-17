import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Canvas as FabricCanvas, Rect, FabricImage } from 'fabric';

interface Citation {
  content: string;
  page_start: number;
  page_end: number;
  manual_id: string;
  content_type?: string;
}

interface PageImage {
  url: string;
  ocr_text?: string;
  bbox_coords?: any;
}

interface DocumentViewerEnhancedProps {
  citations: Citation[];
  manualId: string | null;
  onEvidenceSelect?: (citation: Citation, selectedText: string) => void;
  selectedEvidence?: Set<number>;
}

export function DocumentViewerEnhanced({ 
  citations, 
  manualId, 
  onEvidenceSelect,
  selectedEvidence = new Set()
}: DocumentViewerEnhancedProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [pageImages, setPageImages] = useState<Map<number, PageImage>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedMatches, setHighlightedMatches] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  // Get unique pages from citations
  const pages = Array.from(new Set(
    citations.flatMap(c => {
      const pages = [];
      for (let p = c.page_start; p <= (c.page_end || c.page_start); p++) {
        pages.push(p);
      }
      return pages;
    })
  )).sort((a, b) => a - b);

  useEffect(() => {
    if (manualId && pages.length > 0) {
      loadPageImages();
    }
  }, [manualId, pages.length]);

  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      const canvas = new FabricCanvas(canvasRef.current, {
        width: 800,
        height: 1000,
        selection: false,
      });
      fabricCanvasRef.current = canvas;

      return () => {
        canvas.dispose();
        fabricCanvasRef.current = null;
      };
    }
  }, []);

  useEffect(() => {
    if (fabricCanvasRef.current && pageImages.has(currentPage)) {
      renderPageWithOverlay(currentPage);
    }
  }, [currentPage, pageImages, searchTerm, zoom]);

  const loadPageImages = async () => {
    if (!manualId) return;
    
    setLoading(true);
    try {
      // Fetch figures (page images) with OCR data
      const { data: figures, error } = await supabase
        .from('figures')
        .select('page_number, storage_path, storage_url, ocr_text, bbox_pdf_coords, raw_image_metadata')
        .eq('manual_id', manualId)
        .in('page_number', pages)
        .eq('is_visible', true);

      if (error) {
        console.error('Error loading page images:', error);
        setLoading(false);
        return;
      }

      const imageMap = new Map<number, PageImage>();
      
      for (const figure of figures || []) {
        let url = '';
        
        if (figure.storage_path) {
          const { data } = supabase.storage
            .from('postparse')
            .getPublicUrl(figure.storage_path);
          url = data?.publicUrl || '';
        } else if (figure.storage_url) {
          url = figure.storage_url;
        }

        if (url) {
          imageMap.set(figure.page_number, {
            url,
            ocr_text: figure.ocr_text || undefined,
            bbox_coords: figure.bbox_pdf_coords || figure.raw_image_metadata,
          });
        }
      }

      setPageImages(imageMap);
      setLoading(false);
    } catch (error) {
      console.error('Error loading page images:', error);
      setLoading(false);
    }
  };

  const renderPageWithOverlay = async (page: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const pageData = pageImages.get(page);
    if (!pageData) return;

    // Clear canvas
    canvas.clear();

    // Load and render image using Fabric.js v6 API
    try {
      const imgElement = await FabricImage.fromURL(pageData.url, {
        crossOrigin: 'anonymous',
      });

      const scale = (zoom / 100) * (800 / (imgElement.width || 800));
      
      canvas.setDimensions({
        width: (imgElement.width || 800) * scale,
        height: (imgElement.height || 1000) * scale,
      });

      imgElement.scale(scale);
      imgElement.set({
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });

      canvas.add(imgElement);
      canvas.sendObjectToBack(imgElement);
      
      // Render OCR overlay if available
      if (pageData.ocr_text && searchTerm) {
        highlightSearchMatches(pageData.ocr_text, canvas, scale);
      }

      // Highlight selected evidence
      renderEvidenceHighlights(page, canvas, scale);
      
      canvas.renderAll();
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  const highlightSearchMatches = (ocrText: string, canvas: FabricCanvas, scale: number) => {
    if (!searchTerm) return;

    const regex = new RegExp(searchTerm, 'gi');
    let match;
    const matches: number[] = [];

    while ((match = regex.exec(ocrText)) !== null) {
      matches.push(match.index);
      
      // Create highlight rectangle (approximated position)
      const estimatedY = (match.index / ocrText.length) * (canvas.height || 1000);
      const rect = new Rect({
        left: 10,
        top: estimatedY,
        width: 200,
        height: 20,
        fill: 'yellow',
        opacity: 0.4,
        selectable: false,
      });
      canvas.add(rect);
    }

    setHighlightedMatches(matches);
    canvas.renderAll();
  };

  const renderEvidenceHighlights = (page: number, canvas: FabricCanvas, scale: number) => {
    const citationsOnPage = citations.filter((c, idx) => 
      c.page_start <= page && 
      (c.page_end || c.page_start) >= page &&
      selectedEvidence.has(idx)
    );

    citationsOnPage.forEach(citation => {
      // Create highlight box for selected evidence
      const rect = new Rect({
        left: 20,
        top: 50,
        width: (canvas.width || 800) - 40,
        height: 100,
        fill: 'rgba(34, 197, 94, 0.2)',
        stroke: '#22c55e',
        strokeWidth: 2,
        selectable: false,
      });
      canvas.add(rect);
    });

    canvas.renderAll();
  };

  const citationsOnPage = citations.filter(c => 
    c.page_start <= currentPage && (c.page_end || c.page_start) >= currentPage
  );

  if (!manualId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Viewer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No manual selected. The document viewer will show pages from the retrieved evidence.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (pages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Viewer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No pages available to display.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Thumbnail Sidebar */}
      <div className="col-span-2">
        <Card className="h-[800px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Pages</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[700px]">
              <div className="space-y-2">
                {pages.map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-full p-2 rounded border-2 transition-all ${
                      page === currentPage 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="aspect-[8.5/11] bg-muted rounded mb-1 overflow-hidden">
                      {pageImages.has(page) && (
                        <img 
                          src={pageImages.get(page)?.url} 
                          alt={`Page ${page}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <p className="text-xs text-center font-medium">Page {page}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Main Viewer */}
      <div className="col-span-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Viewer
                <Badge variant="secondary">Page {currentPage}</Badge>
                {highlightedMatches.length > 0 && (
                  <Badge variant="default">{highlightedMatches.length} matches</Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search in document..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-0 h-7 w-40 p-0 focus-visible:ring-0"
                  />
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom(Math.max(50, zoom - 25))}
                  disabled={zoom <= 50}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom(Math.min(200, zoom + 25))}
                  disabled={zoom >= 200}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Page Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(pages[Math.max(0, pages.indexOf(currentPage) - 1)])}
                disabled={pages.indexOf(currentPage) === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <span className="text-sm text-muted-foreground">
                Page {pages.indexOf(currentPage) + 1} of {pages.length}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(pages[Math.min(pages.length - 1, pages.indexOf(currentPage) + 1)])}
                disabled={pages.indexOf(currentPage) === pages.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Canvas with Image + Overlay */}
            <div className="border rounded-lg overflow-hidden bg-muted/30 flex justify-center">
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Loading page...</p>
                </div>
              ) : (
                <canvas ref={canvasRef} />
              )}
            </div>

            {/* OCR Text Display */}
            {pageImages.get(currentPage)?.ocr_text && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">OCR Text (Selectable)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <p className="text-sm whitespace-pre-wrap select-text">
                      {pageImages.get(currentPage)?.ocr_text}
                    </p>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Evidence on Page */}
            {citationsOnPage.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Retrieved Evidence on Page {currentPage} ({citationsOnPage.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {citationsOnPage.map((citation, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border text-sm ${
                        selectedEvidence.has(idx)
                          ? 'bg-green-50 border-green-400'
                          : 'bg-muted/50'
                      }`}
                    >
                      {citation.content_type === 'figure' && (
                        <Badge variant="secondary" className="mb-2">Figure/Diagram</Badge>
                      )}
                      <p className="whitespace-pre-wrap">{citation.content.substring(0, 300)}</p>
                      {citation.content.length > 300 && (
                        <p className="text-muted-foreground">...</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
