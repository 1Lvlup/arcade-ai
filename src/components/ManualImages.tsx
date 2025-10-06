import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Image, Eye, Edit, Save, X, RefreshCw, Sparkles, Wand2, Trash2 } from 'lucide-react';

interface Figure {
  id: string;
  figure_id: string;
  storage_path: string;
  caption_text: string | null;
  ocr_text: string | null;
  vision_text: string | null;
  page_number: number | null;
  keywords: string[] | null;
  created_at: string;
}

interface ManualImagesProps {
  manualId: string;
}

export function ManualImages({ manualId }: ManualImagesProps) {
  const [figures, setFigures] = useState<Figure[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFigure, setEditingFigure] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [generatingCaption, setGeneratingCaption] = useState<string | null>(null);
  const [selectedFigures, setSelectedFigures] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchFigures();
    
    // Set up real-time subscription for caption updates
    const channel = supabase
      .channel('figures-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'figures',
          filter: `manual_id=eq.${manualId}`
        },
        (payload) => {
          console.log('Figure updated:', payload);
          // Update the specific figure in the list
          setFigures(prev => prev.map(fig => 
            fig.id === payload.new.id ? { ...fig, ...payload.new } : fig
          ));
        }
      )
      .subscribe();

    // Also poll every 10 seconds for the first 5 minutes to catch any updates
    const pollInterval = setInterval(() => {
      fetchFigures();
    }, 10000);

    // Clean up after 5 minutes
    const cleanupTimeout = setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);

    return () => {
      channel.unsubscribe();
      clearInterval(pollInterval);
      clearTimeout(cleanupTimeout);
    };
  }, [manualId]);

  const fetchFigures = async () => {
    try {
      const { data, error } = await supabase
        .from('figures')
        .select('*')
        .eq('manual_id', manualId)
        .order('page_number', { ascending: true });

      if (error) throw error;
      setFigures(data || []);
    } catch (error) {
      console.error('Error fetching figures:', error);
      toast({
        title: 'Error loading images',
        description: 'Failed to load manual images',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCaption = async (figure: Figure) => {
    setGeneratingCaption(figure.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image-caption', {
        body: { 
          figure_id: figure.id,
          storage_path: figure.storage_path,
          manual_id: manualId 
        }
      });

      if (error) throw error;

      // Edge function already updated the database, just show success
      toast({
        title: 'Caption generated',
        description: 'AI caption has been generated and saved',
      });
      
      // Wait a moment for database update to propagate, then refresh
      setTimeout(() => {
        fetchFigures();
      }, 500);
    } catch (error) {
      console.error('Error generating caption:', error);
      toast({
        title: 'Error generating caption',
        description: 'Failed to generate AI caption. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingCaption(null);
    }
  };

  const saveCaption = async (figureId: string) => {
    try {
      const { error } = await supabase
        .from('figures')
        .update({ caption_text: captionText })
        .eq('id', figureId);

      if (error) throw error;

      toast({
        title: 'Caption saved',
        description: 'Image caption has been updated',
      });
      
      setEditingFigure(null);
      setCaptionText('');
      fetchFigures(); // Refresh the list
    } catch (error) {
      console.error('Error saving caption:', error);
      toast({
        title: 'Error saving caption',
        description: 'Failed to save caption. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const startEditing = (figure: Figure) => {
    setEditingFigure(figure.id);
    setCaptionText(figure.caption_text || '');
  };

  const cancelEditing = () => {
    setEditingFigure(null);
    setCaptionText('');
  };

  const deleteFigure = async (figureId: string) => {
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('figures')
        .delete()
        .eq('id', figureId);

      if (error) throw error;

      toast({
        title: 'Image deleted',
        description: 'The image has been removed from this manual',
      });
      
      fetchFigures();
    } catch (error) {
      console.error('Error deleting figure:', error);
      toast({
        title: 'Error deleting image',
        description: 'Failed to delete the image. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const deleteSelectedFigures = async () => {
    if (selectedFigures.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedFigures.size} image(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('figures')
        .delete()
        .in('id', Array.from(selectedFigures));

      if (error) throw error;

      toast({
        title: 'Images deleted',
        description: `${selectedFigures.size} image(s) have been removed`,
      });
      
      setSelectedFigures(new Set());
      fetchFigures();
    } catch (error) {
      console.error('Error deleting figures:', error);
      toast({
        title: 'Error deleting images',
        description: 'Failed to delete the images. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const toggleFigureSelection = (figureId: string) => {
    setSelectedFigures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(figureId)) {
        newSet.delete(figureId);
      } else {
        newSet.add(figureId);
      }
      return newSet;
    });
  };

  const selectAllFigures = () => {
    if (selectedFigures.size === figures.length) {
      setSelectedFigures(new Set());
    } else {
      setSelectedFigures(new Set(figures.map(f => f.id)));
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-foreground">
            <Image className="h-6 w-6" />
            <span>Manual Images</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3 text-muted-foreground">Loading images...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2 text-green-900">
            <Image className="h-6 w-6" />
            <span>Manual Images</span>
            <Badge variant="secondary">{figures.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedFigures.size > 0 && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteSelectedFigures}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete {selectedFigures.size} Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFigures(new Set())}
                >
                  Clear Selection
                </Button>
              </>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchFigures}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        {figures.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              checked={selectedFigures.size === figures.length && figures.length > 0}
              onCheckedChange={selectAllFigures}
              id="select-all"
            />
            <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
              Select all
            </label>
          </div>
        )}
        {figures.some(f => !f.caption_text) && (
          <p className="text-sm text-muted-foreground mt-2">
            🤖 AI captions are being generated in the background. They'll appear automatically when ready.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {figures.length === 0 ? (
          <div className="text-center py-12">
            <Image className="h-16 w-16 mx-auto mb-4 text-green-300" />
            <h3 className="text-xl font-semibold text-green-900 mb-2">No Images Found</h3>
            <p className="text-green-600">
              No images were extracted from this manual during processing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {figures.map((figure) => (
              <Card key={figure.id} className="border-green-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="relative mb-4">
                    <img 
                      src={`${supabase.storage.from('postparse').getPublicUrl(figure.storage_path).data.publicUrl}`}
                      alt={figure.caption_text || 'Manual figure'}
                      className="w-full h-48 object-cover rounded-lg border border-green-200"
                    />
                    <div className="absolute top-2 right-2 flex space-x-1">
                      {figure.page_number && (
                        <Badge variant="secondary" className="text-xs">
                          Page {figure.page_number}
                        </Badge>
                      )}
                    </div>
                    <div className="absolute top-2 left-2 flex items-center gap-2">
                      <div className="bg-white rounded p-1 shadow">
                        <Checkbox
                          checked={selectedFigures.has(figure.id)}
                          onCheckedChange={() => toggleFigureSelection(figure.id)}
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteFigure(figure.id)}
                        title="Delete this image"
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Caption Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-green-900">Caption</label>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateCaption(figure)}
                            disabled={generatingCaption === figure.id}
                            title="Generate AI caption"
                          >
                            {generatingCaption === figure.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(figure)}
                            title="Edit caption"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {editingFigure === figure.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={captionText}
                            onChange={(e) => setCaptionText(e.target.value)}
                            placeholder="Enter image caption..."
                            className="min-h-[80px]"
                          />
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => saveCaption(figure.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelEditing}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg min-h-[80px]">
                          {figure.caption_text || (
                            <span className="italic text-gray-400">
                              No caption available. Click edit to add one or use AI to generate.
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* OCR Text */}
                    {figure.ocr_text && (
                      <div>
                        <label className="text-sm font-semibold text-green-900">Text in Image</label>
                        <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
                          {figure.ocr_text}
                        </p>
                      </div>
                    )}

                    {/* Keywords */}
                    {figure.keywords && figure.keywords.length > 0 && (
                      <div>
                        <label className="text-sm font-semibold text-green-900 mb-2 block">Keywords</label>
                        <div className="flex flex-wrap gap-1">
                          {figure.keywords.map((keyword, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* View Full Size */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="h-4 w-4 mr-2" />
                          View Full Size
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>
                            {figure.caption_text || `Figure ${figure.figure_id}`}
                            {figure.page_number && ` - Page ${figure.page_number}`}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="flex justify-center">
                          <img 
                            src={`${supabase.storage.from('postparse').getPublicUrl(figure.storage_path).data.publicUrl}`}
                            alt={figure.caption_text || 'Manual figure'}
                            className="max-w-full max-h-[70vh] object-contain rounded-lg"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}