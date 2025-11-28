import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SharedHeader } from '@/components/SharedHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Settings, Database, Users, Activity, ArrowLeft, MessageSquare, FileText, Eye, Edit, Trash2, ExternalLink, FileCode } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import TenantManagement from './TenantManagement';
import { ManualUpload } from '@/components/ManualUpload';
import { ManualsList } from '@/components/ManualsList';
import { BulkManualImport } from '@/components/BulkManualImport';
import { StructuredCSVImport } from '@/components/StructuredCSVImport';
import { ManualMerge } from '@/components/ManualMerge';
import GameManagement from './GameManagement';
import ManualAdmin from './ManualAdmin';
import { GameRequestsList } from '@/components/GameRequestsList';
import AIConfiguration from './AIConfiguration';
import TrainingInbox from './TrainingInbox';
import TrainingExamples from './TrainingExamples';
import TrainingQAGeneration from './TrainingQAGeneration';
import TrainingExport from './TrainingExport';
import QAAnalytics from './QAAnalytics';
import UserConversationHistory from './UserConversationHistory';
import { UsageTrackingDashboard } from '@/components/UsageTrackingDashboard';
import { StrategicAnalytics } from '@/components/StrategicAnalytics';
import { SMSAnalyticsDashboard } from '@/components/SMSAnalyticsDashboard';
import { SMSSettingsManager } from '@/components/SMSSettingsManager';
import { SMSTestSender } from '@/components/SMSTestSender';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('system');
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [blogStats, setBlogStats] = useState({ total: 0, published: 0, drafts: 0, totalViews: 0 });
  const [loadingBlog, setLoadingBlog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (activeTab === 'blog') {
      loadBlogData();
    }
  }, [activeTab]);

  const loadBlogData = async () => {
    setLoadingBlog(true);
    try {
      const { data: posts, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          blog_categories (
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBlogPosts(posts || []);
      
      const total = posts?.length || 0;
      const published = posts?.filter(p => p.status === 'published').length || 0;
      const drafts = posts?.filter(p => p.status === 'draft').length || 0;
      const totalViews = posts?.reduce((sum, p) => sum + (p.views_count || 0), 0) || 0;

      setBlogStats({ total, published, drafts, totalViews });
    } catch (error) {
      console.error('Error loading blog data:', error);
      toast({
        title: 'Error loading blog posts',
        description: 'Failed to fetch blog data',
        variant: 'destructive',
      });
    } finally {
      setLoadingBlog(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return;

    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Blog post deleted successfully',
      });

      loadBlogData();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete blog post',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <SharedHeader />
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          
          <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
            <SidebarTrigger className="-ml-1" />
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Admin Control Center</h1>
                <p className="text-xs text-muted-foreground">Centralized management hub</p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Hide tab list since we have sidebar navigation */}
              <TabsList className="sr-only">
                <TabsTrigger value="system">System</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="ai">AI & Training</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* SYSTEM MANAGEMENT TAB */}
              <TabsContent value="system" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCode className="h-5 w-5" />
                      System Architecture
                    </CardTitle>
                    <CardDescription>
                      View detailed file mappings, edge functions, and database schema for each feature area
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to="/admin/system-architecture">
                      <Button className="w-full">
                        <FileCode className="mr-2 h-4 w-4" />
                        Open System Architecture Dashboard
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Tenant & User Management Section */}
                <Card className="border-l-4 border-l-orange">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Tenant & User Management
                    </CardTitle>
                    <CardDescription>
                      Manage tenant manual access and user permissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TenantManagement />
                  </CardContent>
                </Card>

                {/* Server Capacity Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Server Capacity Status
                    </CardTitle>
                    <CardDescription>
                      Current system capacity and performance metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="text-sm font-medium text-muted-foreground">Database</div>
                        <div className="text-2xl font-bold text-green-500 mt-1">Healthy</div>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="text-sm font-medium text-muted-foreground">Edge Functions</div>
                        <div className="text-2xl font-bold text-green-500 mt-1">Online</div>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="text-sm font-medium text-muted-foreground">Storage</div>
                        <div className="text-2xl font-bold text-green-500 mt-1">Available</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CONTENT MANAGEMENT TAB */}
              <TabsContent value="content" className="space-y-6 mt-0">
                {/* Manual Administration */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Manual Administration
                    </CardTitle>
                    <CardDescription>
                      Manage manual metadata, indexing, and backfill operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ManualAdmin />
                  </CardContent>
                </Card>

                {/* Document Upload & Processing */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle>Document Upload & Processing</CardTitle>
                    <CardDescription>
                      Upload and manage individual documents and bulk imports
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <ManualUpload />
                      <ManualsList />
                    </div>
                    
                    <div className="space-y-6">
                      <StructuredCSVImport />
                      <BulkManualImport />
                      <ManualMerge />
                    </div>
                  </CardContent>
                </Card>

                {/* Game Requests & Management */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card className="border-l-4 border-l-yellow-500">
                    <CardHeader>
                      <CardTitle>Game Requests</CardTitle>
                      <CardDescription>
                        View and manage game requests from users
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <GameRequestsList />
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-purple-500">
                    <CardHeader>
                      <CardTitle>Game Management</CardTitle>
                      <CardDescription>
                        Manage game submissions and metadata
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <GameManagement />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* AI & TRAINING TAB */}
              <TabsContent value="ai" className="space-y-6 mt-0">
                {/* AI Configuration */}
                <Card className="border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      AI Configuration
                    </CardTitle>
                    <CardDescription>
                      Manage AI models, system prompts, and search settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AIConfiguration />
                  </CardContent>
                </Card>

                {/* Training Hub Overview */}
                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          Training Hub
                        </CardTitle>
                        <CardDescription>
                          Review queries, manage examples, and generate QA data
                        </CardDescription>
                      </div>
                      <Button variant="outline" onClick={() => window.location.href = '/training-hub'}>
                        Open Training Hub
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertTitle>Quick Access</AlertTitle>
                      <AlertDescription>
                        Access detailed training workflows, review individual queries, and manage training examples in the dedicated Training Hub interface.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/training-hub/inbox'}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Training Inbox</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">Review flagged queries and improve responses</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/training-hub/examples'}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Training Examples</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">Manage verified training examples</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/training-hub/qa-generate'}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">QA Generation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">Generate Q&A pairs for training</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/training-hub/export'}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Export Training Data</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">Export verified examples for fine-tuning</p>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                {/* QA Analytics */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      QA Analytics
                    </CardTitle>
                    <CardDescription>
                      Comprehensive analysis of AI responses with quality grades
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <QAAnalytics />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ANALYTICS TAB */}
              <TabsContent value="analytics" className="space-y-6 mt-0">
                {/* User Conversation History */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      User Conversation History
                    </CardTitle>
                    <CardDescription>
                      View and analyze all user conversations across tenants
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertTitle>How to use</AlertTitle>
                      <AlertDescription>
                        1. Select a user from the dropdown to view their conversations<br />
                        2. Click on a conversation to view its message history
                      </AlertDescription>
                    </Alert>
                    <UserConversationHistory />
                  </CardContent>
                </Card>

                {/* SMS Analytics */}
                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      SMS Support Analytics
                    </CardTitle>
                    <CardDescription>
                      Track SMS questions, response times, and popular topics from technicians
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SMSAnalyticsDashboard />
                  </CardContent>
                </Card>

                {/* Usage & Performance */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card className="border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Usage Tracking
                      </CardTitle>
                      <CardDescription>
                        Monitor query usage and limits
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <UsageTrackingDashboard />
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-purple-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Strategic Analytics
                      </CardTitle>
                      <CardDescription>
                        Performance metrics and trends
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <StrategicAnalytics />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* BLOG MANAGEMENT TAB */}
              <TabsContent value="blog" className="space-y-6 mt-0">
                {/* Blog Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Posts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{blogStats.total}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Views</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        {blogStats.totalViews}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{blogStats.published}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-muted-foreground">{blogStats.drafts}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Blog Posts List */}
                <Card className="border-l-4 border-l-primary">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Blog Posts
                        </CardTitle>
                        <CardDescription>
                          Manage your blog posts and track performance
                        </CardDescription>
                      </div>
                      <Button onClick={() => navigate('/admin/blog/new')}>
                        New Post
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingBlog ? (
                      <div className="text-center py-8 text-muted-foreground">Loading blog posts...</div>
                    ) : blogPosts.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No blog posts yet</p>
                        <Button onClick={() => navigate('/admin/blog/new')}>Create Your First Post</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {blogPosts.map((post) => (
                          <Card key={post.id} className="hover:bg-accent/50 transition-colors">
                            <CardContent className="pt-6">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-lg truncate">{post.title}</h3>
                                    <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                                      {post.status}
                                    </Badge>
                                    {post.blog_categories && (
                                      <Badge variant="outline">{post.blog_categories.name}</Badge>
                                    )}
                                  </div>
                                  
                                  {post.excerpt && (
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                      {post.excerpt}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Eye className="h-3 w-3" />
                                      <span>{post.views_count || 0} views</span>
                                    </div>
                                    {post.author_name && (
                                      <span>By {post.author_name}</span>
                                    )}
                                    {post.read_time_minutes && (
                                      <span>{post.read_time_minutes} min read</span>
                                    )}
                                    {post.published_at ? (
                                      <span>Published {format(new Date(post.published_at), 'MMM d, yyyy')}</span>
                                    ) : (
                                      <span>Created {format(new Date(post.created_at), 'MMM d, yyyy')}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => navigate(`/admin/blog/edit/${post.id}`)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeletePost(post.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SMS SETTINGS TAB */}
              <TabsContent value="sms-settings" className="space-y-6 mt-0">
                <Card className="border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      SMS Onboarding Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure welcome messages and onboarding flow for SMS users
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SMSSettingsManager />
                  </CardContent>
                </Card>

                <SMSTestSender />
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
    </>
  );
};

export default AdminDashboard;
