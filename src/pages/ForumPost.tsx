import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Loader2, ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SharedHeader } from "@/components/SharedHeader";

interface Post {
  id: string;
  title: string;
  content: string;
  game_name: string | null;
  tags: string[];
  is_resolved: boolean;
  created_at: string;
  user_id: string;
}

interface Comment {
  id: string;
  content: string;
  is_solution: boolean;
  created_at: string;
  user_id: string;
}

export default function ForumPost() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchPost();
    fetchComments();
    getCurrentUser();
  }, [id]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from("forum_posts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPost(data);
    } catch (error: any) {
      toast({
        title: "Error loading post",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("forum_comments")
        .select("*")
        .eq("post_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading comments",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Empty comment",
        description: "Please write a comment before submitting",
        variant: "destructive",
      });
      return;
    }

    if (!currentUser) {
      toast({
        title: "Not logged in",
        description: "You must be logged in to comment",
        variant: "destructive",
      });
      return;
    }

    setCommenting(true);
    try {
      const { error } = await supabase.from("forum_comments").insert({
        post_id: id,
        user_id: currentUser.id,
        content: newComment,
      });

      if (error) throw error;

      toast({
        title: "Comment added",
        description: "Your response has been posted",
      });

      setNewComment("");
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error adding comment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCommenting(false);
    }
  };

  const markAsSolution = async (commentId: string) => {
    try {
      // Mark comment as solution
      const { error: commentError } = await supabase
        .from("forum_comments")
        .update({ is_solution: true })
        .eq("id", commentId);

      if (commentError) throw commentError;

      // Mark post as resolved
      const { error: postError } = await supabase
        .from("forum_posts")
        .update({ is_resolved: true })
        .eq("id", id);

      if (postError) throw postError;

      toast({
        title: "Solution marked",
        description: "This post has been marked as solved",
      });

      fetchPost();
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error marking solution",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SharedHeader />
        <div className="container mx-auto px-4 py-8 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <SharedHeader />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Post not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/forum")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Forum
        </Button>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2 flex items-center gap-2">
                  {post.title}
                  {post.is_resolved && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Solved
                    </Badge>
                  )}
                </CardTitle>
                {post.game_name && (
                  <Badge variant="secondary" className="mb-4">
                    {post.game_name}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
          </CardContent>
          
          <CardFooter className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{formatDistanceToNow(new Date(post.created_at))} ago</span>
            </div>
            
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardFooter>
        </Card>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">
            {comments.length} {comments.length === 1 ? "Response" : "Responses"}
          </h2>
          <Separator />
        </div>

        <div className="space-y-4 mb-8">
          {comments.map((comment) => (
            <Card
              key={comment.id}
              className={comment.is_solution ? "border-green-500 border-2" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(comment.created_at))} ago</span>
                  </div>
                  
                  {comment.is_solution && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Solution
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{comment.content}</p>
              </CardContent>
              
              {!post.is_resolved && currentUser?.id === post.user_id && (
                <CardFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAsSolution(comment.id)}
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Mark as Solution
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>

        {!post.is_resolved && (
          <Card>
            <CardHeader>
              <CardTitle>Add Your Response</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Share your knowledge and help solve this problem..."
                className="min-h-[150px]"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
            </CardContent>
            <CardFooter>
              <Button onClick={addComment} disabled={commenting}>
                {commenting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Post Response
              </Button>
            </CardFooter>
          </Card>
        )}
      </main>
    </div>
  );
}
