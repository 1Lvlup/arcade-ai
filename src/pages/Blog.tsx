import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar, User, ArrowRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { SharedHeader } from '@/components/SharedHeader';
import { useAuth } from '@/hooks/useAuth';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image: string | null;
  published_at: string;
  read_time_minutes: number | null;
  author_name: string | null;
  category: {
    name: string;
    slug: string;
  } | null;
}

export default function Blog() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    const { data } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });
    
    setIsAdmin(data || false);
  };

  useEffect(() => {
    loadCategories();
    loadPosts();
  }, [selectedCategory]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('blog_categories')
      .select('id, name, slug')
      .order('name');
    
    if (data) setCategories(data);
  };

  const loadPosts = async () => {
    setLoading(true);
    let query = supabase
      .from('blog_posts')
      .select(`
        id,
        title,
        slug,
        excerpt,
        featured_image,
        published_at,
        read_time_minutes,
        author_name,
        category:blog_categories(name, slug)
      `)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (selectedCategory !== 'all') {
      const category = categories.find(c => c.slug === selectedCategory);
      if (category) {
        query = query.eq('category_id', category.id);
      }
    }

    const { data } = await query;
    if (data) setPosts(data as any);
    setLoading(false);
  };

  return (
    <div className="min-h-screen arcade-bg">
      <SharedHeader />
      
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
            Back to Home
          </Button>
        </Link>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1" />
            <h1 className="text-5xl font-tech font-bold text-foreground flex-1">
              Arcade Intelligence Blog
            </h1>
            <div className="flex-1 flex justify-end">
              {isAdmin && (
                <Link to="/admin/blog/new">
                  <Button variant="orange">
                    <Plus className="mr-2 h-4 w-4" />
                    New Post
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Expert guides, troubleshooting tips, and industry insights for arcade operators
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap justify-center mb-8">
          <Button
            variant={selectedCategory === 'all' ? 'orange' : 'outline'}
            onClick={() => setSelectedCategory('all')}
          >
            All Posts
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.slug ? 'orange' : 'outline'}
              onClick={() => setSelectedCategory(category.slug)}
            >
              {category.name}
            </Button>
          ))}
        </div>

        {/* Blog Posts Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-primary/30">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="border-primary/30">
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No blog posts found in this category.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`}>
                <Card className="border-primary/30 hover:border-primary transition-all h-full">
                  {post.featured_image && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={post.featured_image}
                        alt={post.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex gap-2 mb-2">
                      {post.category && (
                        <Badge variant="secondary">{post.category.name}</Badge>
                      )}
                    </div>
                    <CardTitle className="line-clamp-2 text-foreground hover:text-primary transition-colors">
                      {post.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {post.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(post.published_at), 'MMM d, yyyy')}
                      </div>
                      {post.read_time_minutes && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {post.read_time_minutes} min
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-center text-primary font-semibold">
                      Read More <ArrowRight className="ml-1 h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
