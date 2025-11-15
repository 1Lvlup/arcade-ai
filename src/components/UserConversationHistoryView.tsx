import { useState, useEffect } from 'react';
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

export function UserConversationHistoryView() {
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
    <div className="space-y-4">
      {/* User Selection */}
      <div>
        <label className="text-sm font-medium mb-2 block">Select User</label>
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a user..." />
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
        <div>
          <label className="text-sm font-medium mb-2 block">Conversations</label>
          {loadingConversations ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No conversations found</p>
          ) : (
            <ScrollArea className="h-[200px] border rounded-md">
              <div className="p-2 space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedConversationId === conv.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 flex-shrink-0" />
                          <span className="font-medium truncate">{conv.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(conv.last_message_at), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
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
        <div>
          <label className="text-sm font-medium mb-2 block">Messages</label>
          {loadingMessages ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No messages found</p>
          ) : (
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-2 ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <Badge variant={msg.role === 'user' ? 'default' : 'secondary'}>
                      {msg.role}
                    </Badge>
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-2">
                        {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
