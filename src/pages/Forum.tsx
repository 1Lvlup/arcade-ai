import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, CheckCircle2, Plus, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SharedHeader } from "@/components/SharedHeader";

interface ForumPost {
  id: string;
  title: string;
  content: string;
  game_name: string | null;
  tags: string[];
  is_resolved: boolean;
  created_at: string;
  user_id: string;
  upvote_count: number;
  downvote_count: number;
  forum_comments: { count: number }[];
  user_vote?: { vote_type: string } | null;
}

export default function Forum() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filterResolved, setFilterResolved] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    game_name: "",
    tags: "",
  });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
    getCurrentUser();
  }, [filterResolved]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from("forum_posts")
        .select(`
          *,
          forum_comments(count),
          user_vote:forum_votes!forum_votes_post_id_fkey(vote_type)
        `)
        .order("created_at", { ascending: false });

      if (filterResolved !== null) {
        query = query.eq("is_resolved", filterResolved);
      }

      if (user) {
        query = query.eq("forum_votes.user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Transform the data to handle the user_vote relationship
      const transformedData = data?.map(post => ({
        ...post,
        user_vote: Array.isArray(post.user_vote) && post.user_vote.length > 0 
          ? post.user_vote[0] 
          : null
      }));
      
      setPosts(transformedData || []);
    } catch (error: any) {
      toast({
        title: "Error loading posts",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!newPost.title || !newPost.content) {
      toast({
        title: "Missing fields",
        description: "Please fill in title and content",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to create a post");

      const { error } = await supabase.from("forum_posts").insert({
        user_id: user.id,
        title: newPost.title,
        content: newPost.content,
        game_name: newPost.game_name || null,
        tags: newPost.tags ? newPost.tags.split(",").map(t => t.trim()) : [],
      });

      if (error) throw error;

      toast({
        title: "Post created",
        description: "Your question has been posted to the community",
      });

      setIsDialogOpen(false);
      setNewPost({ title: "", content: "", game_name: "", tags: "" });
      fetchPosts();
    } catch (error: any) {
      toast({
        title: "Error creating post",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (postId: string, voteType: 'upvote' | 'downvote', e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!currentUser) {
      toast({
        title: "Login required",
        description: "Please login to vote",
        variant: "destructive",
      });
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      const existingVote = post?.user_vote;

      if (existingVote?.vote_type === voteType) {
        // Remove vote if clicking the same button
        const { error } = await supabase
          .from("forum_votes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", currentUser.id);

        if (error) throw error;
      } else if (existingVote) {
        // Update existing vote
        const { error } = await supabase
          .from("forum_votes")
          .update({ vote_type: voteType })
          .eq("post_id", postId)
          .eq("user_id", currentUser.id);

        if (error) throw error;
      } else {
        // Create new vote
        const { error } = await supabase
          .from("forum_votes")
          .insert({
            post_id: postId,
            user_id: currentUser.id,
            vote_type: voteType,
          });

        if (error) throw error;
      }

      fetchPosts();
    } catch (error: any) {
      toast({
        title: "Error voting",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.game_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Community Forum</h1>
            <p className="text-muted-foreground">Ask questions and help others with arcade game issues</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Ask Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Ask the Community</DialogTitle>
                <DialogDescription>
                  Share your arcade game problem and get help from experienced technicians
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Question Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Pac-Man screen flickering issue"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="game">Game Name</Label>
                  <Input
                    id="game"
                    placeholder="e.g., Pac-Man, Galaga, Street Fighter II"
                    value={newPost.game_name}
                    onChange={(e) => setNewPost({ ...newPost, game_name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="content">Detailed Description *</Label>
                  <Textarea
                    id="content"
                    placeholder="Describe the problem, what you've tried, and any error messages..."
                    className="min-h-[150px]"
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="e.g., monitor, controls, audio"
                    value={newPost.tags}
                    onChange={(e) => setNewPost({ ...newPost, tags: e.target.value })}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createPost} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post Question"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Input
            placeholder="Search posts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:max-w-sm"
          />
          
          <div className="flex gap-2">
            <Button
              variant={filterResolved === null ? "default" : "outline"}
              onClick={() => setFilterResolved(null)}
            >
              All Posts
            </Button>
            <Button
              variant={filterResolved === false ? "default" : "outline"}
              onClick={() => setFilterResolved(false)}
            >
              Unsolved
            </Button>
            <Button
              variant={filterResolved === true ? "default" : "outline"}
              onClick={() => setFilterResolved(true)}
            >
              Solved
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No posts found. Be the first to ask a question!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <Card
                key={post.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/forum/${post.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    {/* Vote buttons */}
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${post.user_vote?.vote_type === 'upvote' ? 'text-primary' : 'text-muted-foreground'}`}
                        onClick={(e) => handleVote(post.id, 'upvote', e)}
                      >
                        <ArrowUp className="w-5 h-5" />
                      </Button>
                      <span className="text-sm font-semibold">
                        {post.upvote_count - post.downvote_count}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${post.user_vote?.vote_type === 'downvote' ? 'text-destructive' : 'text-muted-foreground'}`}
                        onClick={(e) => handleVote(post.id, 'downvote', e)}
                      >
                        <ArrowDown className="w-5 h-5" />
                      </Button>
                    </div>
                    
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2 flex items-center gap-2">
                        {post.title}
                        {post.is_resolved && (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        )}
                      </CardTitle>
                      {post.game_name && (
                        <Badge variant="secondary" className="mb-2">
                          {post.game_name}
                        </Badge>
                      )}
                      <CardDescription className="line-clamp-2">
                        {post.content}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>{formatDistanceToNow(new Date(post.created_at))} ago</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.forum_comments?.[0]?.count || 0} replies</span>
                  </div>
                </CardFooter>
                
                {post.tags && post.tags.length > 0 && (
                  <CardFooter className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
