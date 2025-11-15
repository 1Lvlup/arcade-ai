import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar, User, ArrowLeft, Share2, Facebook, Twitter, Linkedin } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { SharedHeader } from '@/components/SharedHeader';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  featured_image: string | null;
  published_at: string;
  read_time_minutes: number | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  category: {
    name: string;
    slug: string;
  } | null;
  author: {
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export default function BlogPost() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPost();
  }, [slug]);

  const loadPost = async () => {
    setLoading(true);
    
    // Load main post
    const { data: postData } = await supabase
      .from('blog_posts')
      .select(`
        id,
        title,
        slug,
        content,
        featured_image,
        published_at,
        read_time_minutes,
        meta_description,
        meta_keywords,
        category_id,
        category:blog_categories(name, slug),
        author:profiles(display_name, avatar_url)
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (postData) {
      setPost(postData as any);
      
      // Increment view count
      await supabase
        .from('blog_posts')
        .update({ views_count: (postData as any).views_count + 1 })
        .eq('id', postData.id);

      // Load related posts from same category
      if (postData.category_id) {
        const { data: related } = await supabase
          .from('blog_posts')
          .select(`
            id,
            title,
            slug,
            excerpt,
            featured_image,
            published_at,
            category:blog_categories(name)
          `)
          .eq('category_id', postData.category_id)
          .eq('status', 'published')
          .neq('id', postData.id)
          .limit(3);
        
        if (related) setRelatedPosts(related);
      }
    }
    
    setLoading(false);
  };

  const sharePost = async (platform: string) => {
    const url = window.location.href;
    const title = post?.title || '';
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'copy':
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied to clipboard!' });
        return;
    }
    
    if (shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  if (loading) {
    return (
      <div className="min-h-screen arcade-bg">
        <SharedHeader />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-96 w-full mb-6" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen arcade-bg">
        <SharedHeader />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">Post Not Found</h2>
              <Link to="/blog">
                <Button variant="orange">Back to Blog</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SEO Meta Tags */}
      <head>
        <title>{post.title} | Level Up Arcade Blog</title>
        <meta name="description" content={post.meta_description || post.content.substring(0, 160)} />
        {post.meta_keywords && <meta name="keywords" content={post.meta_keywords.join(', ')} />}
        
        {/* Open Graph */}
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.meta_description || post.content.substring(0, 160)} />
        {post.featured_image && <meta property="og:image" content={post.featured_image} />}
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={post.published_at} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.meta_description || post.content.substring(0, 160)} />
        {post.featured_image && <meta name="twitter:image" content={post.featured_image} />}
      </head>

      <div className="min-h-screen arcade-bg">
        <SharedHeader />
        
        <article className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Back Button */}
          <Link to="/blog">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Button>
          </Link>

          {/* Article Header */}
          <header className="mb-8">
            {post.category && (
              <Badge variant="secondary" className="mb-4">{post.category.name}</Badge>
            )}
            
            <h1 className="text-4xl md:text-5xl font-tech font-bold text-foreground mb-4">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-6">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{post.author?.display_name || 'Level Up Team'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(post.published_at), 'MMMM d, yyyy')}</span>
              </div>
              {post.read_time_minutes && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{post.read_time_minutes} min read</span>
                </div>
              )}
            </div>

            {/* Share Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => sharePost('twitter')}>
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => sharePost('facebook')}>
                <Facebook className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => sharePost('linkedin')}>
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => sharePost('copy')}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Featured Image */}
          {post.featured_image && (
            <div className="aspect-video mb-8 overflow-hidden rounded-lg">
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Article Content */}
          <Card className="border-primary/30 mb-12">
            <CardContent className="prose prose-invert max-w-none p-8">
              <div 
                className="text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </CardContent>
          </Card>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section>
              <h2 className="text-3xl font-tech font-bold text-foreground mb-6">
                Related Articles
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((related) => (
                  <Link key={related.id} to={`/blog/${related.slug}`}>
                    <Card className="border-primary/30 hover:border-primary transition-all h-full">
                      {related.featured_image && (
                        <div className="aspect-video overflow-hidden">
                          <img
                            src={related.featured_image}
                            alt={related.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground line-clamp-2 mb-2">
                          {related.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {related.excerpt}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>

      {/* Schema.org structured data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": post.title,
          "image": post.featured_image,
          "datePublished": post.published_at,
          "author": {
            "@type": "Person",
            "name": post.author?.display_name || "Level Up Team"
          },
          "publisher": {
            "@type": "Organization",
            "name": "Level Up Arcade Intelligence",
            "logo": {
              "@type": "ImageObject",
              "url": "/levelup-logo.svg"
            }
          },
          "description": post.meta_description,
          "keywords": post.meta_keywords?.join(', ')
        })}
      </script>
    </>
  );
}
