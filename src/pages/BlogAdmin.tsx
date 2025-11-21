import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Edit, Plus, ArrowLeft } from 'lucide-react';
import { SharedHeader } from '@/components/SharedHeader';
import { AdminRoute } from '@/components/AdminRoute';

export default function BlogAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPosts();
    loadCategories();
  }, []);

  const loadPosts = async () => {
    const { data } = await supabase
      .from('blog_posts')
      .select(`
        id,
        title,
        slug,
        excerpt,
        status,
        author_name,
        views_count,
        published_at,
        created_at,
        category:blog_categories(name)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setPosts(data);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('blog_categories')
      .select('*')
      .order('name');
    
    if (data) setCategories(data);
  };

  const deletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    setLoading(true);
    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({ title: 'Post deleted successfully' });
      loadPosts();
    }
    setLoading(false);
  };

  return (
    <AdminRoute>
      <div className="min-h-screen arcade-bg">
        <SharedHeader />
        
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Link to="/admin">
                <Button variant="ghost">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Admin
                </Button>
              </Link>
              <h1 className="text-4xl font-tech font-bold text-foreground">
                Blog Management
              </h1>
            </div>
            <Link to="/admin/blog/new">
              <Button variant="orange">
                <Plus className="mr-2 h-4 w-4" />
                New Post
              </Button>
            </Link>
          </div>

          {/* Posts List */}
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="border-primary/30">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-2">
                        <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                          {post.status}
                        </Badge>
                        {post.category && (
                          <Badge variant="outline">{post.category.name}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-foreground">{post.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-2">
                        {post.excerpt}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                        <span>Views: {post.views_count || 0}</span>
                        <span>Published: {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Draft'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/admin/blog/edit/${post.id}`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deletePost(post.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {posts.length === 0 && (
            <Card className="border-primary/30">
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground mb-4">No blog posts yet</p>
                <Link to="/admin/blog/new">
                  <Button variant="orange">Create Your First Post</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </AdminRoute>
  );
}
