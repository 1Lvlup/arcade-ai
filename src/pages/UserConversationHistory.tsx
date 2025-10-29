import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SharedHeader } from '@/components/SharedHeader';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageCircle, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
  id: string;
  email: string;
  user_id: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string;
  manual_id: string | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export default function UserConversationHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fetch all user profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      try {
        // First verify we're admin
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
          throw new Error('Not authenticated');
        }

        const { data: isAdminData, error: roleError } = await supabase.rpc('has_role', {
          _user_id: currentUser.id,
          _role: 'admin'
        });

        if (roleError) throw roleError;
        if (!isAdminData) {
          toast({
            title: 'Access Denied',
            description: 'Admin access required',
            variant: 'destructive',
          });
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, user_id')
          .order('email');

        if (error) throw error;
        setProfiles(data || []);
      } catch (error) {
        console.error('Error fetching profiles:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch user profiles',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [toast]);

  // Fetch conversations for selected user
  useEffect(() => {
    if (!selectedUserId) {
      setConversations([]);
      setMessages([]);
      setSelectedConversationId('');
      return;
    }

    const fetchConversations = async () => {
      setLoadingConversations(true);
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', selectedUserId)
          .order('last_message_at', { ascending: false });

        if (error) throw error;
        setConversations(data || []);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch conversations',
          variant: 'destructive',
        });
      } finally {
        setLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [selectedUserId, toast]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const { data, error } = await supabase
          .from('conversation_messages')
          .select('*')
          .eq('conversation_id', selectedConversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch messages',
          variant: 'destructive',
        });
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedConversationId, toast]);

  return (
    <div className="min-h-screen mesh-gradient flex flex-col">
      <SharedHeader title="User Conversation History" showBackButton backTo="/" />

      <main className="container mx-auto px-4 py-8 flex-1">
        <Card className="tech-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <MessageCircle className="h-5 w-5" />
              User Conversation History
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              View conversation history for any user
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select User</label>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading users...
                </div>
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="bg-card text-card-foreground border-primary/20">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.user_id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {profile.email}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Conversations List */}
            {selectedUserId && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Conversations ({conversations.length})
                </label>
                {loadingConversations ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading conversations...
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No conversations found</p>
                ) : (
                  <ScrollArea className="h-[200px] rounded-md border border-primary/20 p-4">
                    <div className="space-y-2">
                      {conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversationId(conv.id)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedConversationId === conv.id
                              ? 'bg-primary/20 border-primary/40'
                              : 'bg-card hover:bg-primary/10'
                          } border border-primary/20`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{conv.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(conv.created_at), 'MMM d, yyyy h:mm a')}
                                </p>
                              </div>
                            </div>
                            {conv.manual_id && (
                              <Badge variant="outline" className="text-xs">
                                Manual
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Messages */}
            {selectedConversationId && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Messages ({messages.length})
                </label>
                {loadingMessages ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages found</p>
                ) : (
                  <ScrollArea className="h-[400px] rounded-md border border-primary/20 p-4">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-4 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-primary/10 ml-8'
                              : 'bg-card mr-8'
                          } border border-primary/20`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={message.role === 'user' ? 'default' : 'secondary'}>
                              {message.role}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(message.created_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {message.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
