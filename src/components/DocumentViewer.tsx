import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Citation {
  content: string;
  page_start: number;
  page_end: number;
  manual_id: string;
  content_type?: string;
}

interface DocumentViewerProps {
  citations: Citation[];
  manualId: string | null;
  onEvidenceSelect?: (citation: Citation, selectedText: string) => void;
  selectedEvidence?: Set<number>;
}

export function DocumentViewer({ 
  citations, 
  manualId, 
  onEvidenceSelect,
  selectedEvidence = new Set()
}: DocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [pageImages, setPageImages] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [highlightedText, setHighlightedText] = useState<string>('');

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

  const loadPageImages = async () => {
    if (!manualId) return;
    
    setLoading(true);
    try {
      // Fetch figures (page images) from the database
      const { data: figures, error } = await supabase
        .from('figures')
        .select('page_number, storage_path, storage_url')
        .eq('manual_id', manualId)
        .in('page_number', pages);

      if (error) {
        console.error('Error loading page images:', error);
        setLoading(false);
        return;
      }

      const imageMap = new Map<number, string>();
      
      for (const figure of figures || []) {
        if (figure.storage_path) {
          const { data } = supabase.storage
            .from('postparse')
            .getPublicUrl(figure.storage_path);
          
          if (data?.publicUrl) {
            imageMap.set(figure.page_number, data.publicUrl);
          }
        } else if (figure.storage_url) {
          imageMap.set(figure.page_number, figure.storage_url);
        }
      }

      setPageImages(imageMap);
      setLoading(false);
    } catch (error) {
      console.error('Error loading page images:', error);
      setLoading(false);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 5) {
      setHighlightedText(text);
      
      // Find which citation this text belongs to
      const citation = citations.find(c => 
        c.page_start <= currentPage && 
        (c.page_end || c.page_start) >= currentPage &&
        c.content.includes(text)
      );
      
      if (citation && onEvidenceSelect) {
        onEvidenceSelect(citation, text);
      }
    }
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Viewer
            <Badge variant="secondary">Page {currentPage}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{zoom}%</span>
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
          
          <div className="flex gap-1 flex-wrap justify-center">
            {pages.map(page => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
          </div>

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

        {/* Page Image with OCR Text Overlay */}
        <div className="relative border rounded-lg overflow-hidden bg-muted/30">
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading page...</p>
            </div>
          ) : pageImages.has(currentPage) ? (
            <div className="relative" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
              <img
                src={pageImages.get(currentPage)}
                alt={`Page ${currentPage}`}
                className="w-full"
              />
              
              {/* OCR Text Overlay - Selectable */}
              <div 
                className="absolute inset-0 bg-transparent cursor-text"
                onMouseUp={handleTextSelection}
              >
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {citationsOnPage.map((citation, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded text-sm select-text ${
                          selectedEvidence.has(idx) 
                            ? 'bg-yellow-200/50 border-2 border-yellow-400' 
                            : 'bg-white/80 hover:bg-white/90'
                        }`}
                      >
                        {citation.content.substring(0, 300)}
                        {citation.content.length > 300 && '...'}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center gap-4 p-8">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">No image available for page {currentPage}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Showing text-only view from retrieved evidence below
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Text Content from Citations */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Retrieved Evidence on Page {currentPage}</h4>
          <ScrollArea className="h-64 border rounded-lg">
            <div className="p-4 space-y-3">
              {citationsOnPage.length === 0 ? (
                <p className="text-sm text-muted-foreground">No evidence retrieved for this page</p>
              ) : (
                citationsOnPage.map((citation, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded border text-sm select-text ${
                      selectedEvidence.has(idx)
                        ? 'bg-yellow-50 border-yellow-400'
                        : 'bg-muted/50'
                    }`}
                    onMouseUp={handleTextSelection}
                  >
                    {citation.content_type === 'figure' && (
                      <Badge variant="secondary" className="mb-2">Figure/Diagram</Badge>
                    )}
                    <p className="whitespace-pre-wrap">{citation.content}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {highlightedText && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <p className="font-medium mb-1">Selected Text:</p>
            <p className="text-muted-foreground">&quot;{highlightedText}&quot;</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
