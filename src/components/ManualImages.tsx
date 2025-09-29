import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Image, Eye, Edit, Save, X, RefreshCw, Sparkles, Wand2 } from 'lucide-react';

interface Figure {
  id: string;
  figure_id: string;
  image_url: string;
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
  const { toast } = useToast();

  useEffect(() => {
    fetchFigures();
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
          image_url: figure.image_url,
          manual_id: manualId 
        }
      });

      if (error) throw error;

      // Update the figure with the new caption
      const { error: updateError } = await supabase
        .from('figures')
        .update({ 
          caption_text: data.caption,
          vision_text: data.vision_analysis 
        })
        .eq('id', figure.id);

      if (updateError) throw updateError;

      toast({
        title: 'Caption generated',
        description: 'AI caption has been generated and saved',
      });
      
      fetchFigures(); // Refresh the list
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

  if (loading) {
    return (
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-green-900">
            <Image className="h-6 w-6" />
            <span>Manual Images</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
            <span className="ml-3 text-gray-600">Loading images...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-green-900">
          <Image className="h-6 w-6" />
          <span>Manual Images</span>
          <Badge variant="secondary">{figures.length}</Badge>
        </CardTitle>
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
                      src={figure.image_url} 
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
                            src={figure.image_url} 
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