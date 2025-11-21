import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Save } from 'lucide-react';
import { SharedHeader } from '@/components/SharedHeader';
import { AdminRoute } from '@/components/AdminRoute';

export default function BlogEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category_id: '',
    featured_image: '',
    meta_description: '',
    meta_keywords: '',
    status: 'draft',
    read_time_minutes: 5,
    author_name: ''
  });

  useEffect(() => {
    loadCategories();
    if (id) loadPost();
  }, [id]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('blog_categories')
      .select('*')
      .order('name');
    
    if (data) setCategories(data);
  };

  const loadPost = async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      setFormData({
        title: data.title || '',
        slug: data.slug || '',
        excerpt: data.excerpt || '',
        content: data.content || '',
        category_id: data.category_id || '',
        featured_image: data.featured_image || '',
        meta_description: data.meta_description || '',
        meta_keywords: data.meta_keywords?.join(', ') || '',
        status: data.status || 'draft',
        read_time_minutes: data.read_time_minutes || 5,
        author_name: data.author_name || ''
      });
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: generateSlug(title)
    }));
  };

  const calculateReadTime = (content: string) => {
    const words = content.split(/\s+/).length;
    return Math.ceil(words / 200); // Assuming 200 words per minute
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content || !formData.category_id) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in title, content, and category',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    const postData = {
      ...formData,
      meta_keywords: formData.meta_keywords ? formData.meta_keywords.split(',').map(k => k.trim()) : [],
      read_time_minutes: calculateReadTime(formData.content),
      published_at: formData.status === 'published' ? new Date().toISOString() : null
    };

    try {
      if (id) {
        const { error } = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', id);

        if (error) throw error;
        toast({ title: 'Post updated successfully!' });
      } else {
        const { error } = await supabase
          .from('blog_posts')
          .insert([postData]);

        if (error) throw error;
        toast({ title: 'Post created successfully!' });
      }

      navigate('/admin/blog');
    } catch (error: any) {
      toast({
        title: 'Error saving post',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminRoute>
      <div className="min-h-screen arcade-bg">
        <SharedHeader />
        
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Button variant="ghost" onClick={() => navigate('/admin/blog')} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog Admin
          </Button>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-foreground">
                {id ? 'Edit Blog Post' : 'Create New Blog Post'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter post title"
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="post-url-slug"
                />
              </div>

              {/* Author Name */}
              <div className="space-y-2">
                <Label htmlFor="author_name">Author Name</Label>
                <Input
                  id="author_name"
                  value={formData.author_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, author_name: e.target.value }))}
                  placeholder="Your name"
                />
              </div>

              {/* Excerpt */}
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Short description for the post card"
                  rows={3}
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Content * (HTML supported)</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your post content here. You can use HTML tags."
                  rows={15}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Estimated read time: {calculateReadTime(formData.content)} minutes
                </p>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Featured Image */}
              <div className="space-y-2">
                <Label htmlFor="featured_image">Featured Image URL</Label>
                <Input
                  id="featured_image"
                  value={formData.featured_image}
                  onChange={(e) => setFormData(prev => ({ ...prev, featured_image: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              {/* SEO Fields */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-lg font-semibold text-foreground">SEO Settings</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Textarea
                    id="meta_description"
                    value={formData.meta_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                    placeholder="Brief description for search engines (max 160 chars)"
                    rows={2}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.meta_description.length}/160 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_keywords">Keywords (comma-separated)</Label>
                  <Input
                    id="meta_keywords"
                    value={formData.meta_keywords}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_keywords: e.target.value }))}
                    placeholder="arcade, troubleshooting, repair"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  variant="orange"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? 'Saving...' : (id ? 'Update Post' : 'Create Post')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </AdminRoute>
  );
}
