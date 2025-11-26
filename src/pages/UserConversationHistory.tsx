import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, MessageSquare, Clock, FileText, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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

const UserConversationHistory = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ totalConversations: 0, totalMessages: 0, avgMessagesPerConv: 0 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState({
    profiles: true,
    conversations: false,
    messages: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
    fetchProfiles();
  }, []);

  const checkAdminStatus = async () => {
    try {
      setCheckingAdmin(true);
      const { data, error } = await supabase.rpc('check_my_admin_status');
      
      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data?.[0]?.has_admin_role || false);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setIsAdmin(false);
    } finally {
      setCheckingAdmin(false);
    }
  };

  const grantAdminAccess = async () => {
    try {
      const { data, error } = await supabase.rpc('grant_me_admin');
      
      if (error) {
        console.error('Error granting admin:', error);
        toast({
          title: 'Error',
          description: 'Failed to grant admin access',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Admin access granted! Refreshing...',
      });
      
      setIsAdmin(true);
      await fetchProfiles();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: 'Error',
        description: 'Failed to grant admin access',
        variant: 'destructive',
      });
    }
  };

  const fetchProfiles = async () => {
    try {
      setLoading(prev => ({ ...prev, profiles: true }));
      setError(null);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, user_id')
        .order('email');

      if (error) {
        console.error('Error fetching profiles:', error);
        setError(`Failed to load users: ${error.message}`);
        toast({
          title: 'Error loading users',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ Loaded profiles:', data?.length);
      setProfiles(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Unexpected error loading users');
      toast({
        title: 'Error',
        description: 'Failed to load user profiles',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, profiles: false }));
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      fetchConversations();
    } else {
      setConversations([]);
      setMessages([]);
      setSelectedConversationId('');
      setStats({ totalConversations: 0, totalMessages: 0, avgMessagesPerConv: 0 });
    }
  }, [selectedUserId]);

  const fetchConversations = async () => {
    try {
      setLoading(prev => ({ ...prev, conversations: true }));
      setError(null);
      
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, created_at, last_message_at, manual_id')
        .eq('user_id', selectedUserId)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        setError(`Failed to load conversations: ${error.message}`);
        toast({
          title: 'Error loading conversations',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ Loaded conversations:', data?.length);
      setConversations(data || []);
      
      // Calculate stats
      const totalConv = data?.length || 0;
      const { count: totalMsg } = await supabase
        .from('conversation_messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', data?.map(c => c.id) || []);
      
      setStats({
        totalConversations: totalConv,
        totalMessages: totalMsg || 0,
        avgMessagesPerConv: totalConv > 0 ? Math.round((totalMsg || 0) / totalConv) : 0,
      });
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Unexpected error loading conversations');
      toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, conversations: false }));
    }
  };

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [selectedConversationId]);

  const fetchMessages = async () => {
    try {
      setLoading(prev => ({ ...prev, messages: true }));
      setError(null);
      
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        setError(`Failed to load messages: ${error.message}`);
        toast({
          title: 'Error loading messages',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ Loaded messages:', data?.length);
      setMessages(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Unexpected error loading messages');
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, messages: false }));
    }
  };

  const handleExport = () => {
    if (!selectedConversationId || messages.length === 0) return;
    
    const conv = conversations.find(c => c.id === selectedConversationId);
    const exportData = {
      conversation: {
        title: conv?.title,
        created_at: conv?.created_at,
        manual_id: conv?.manual_id,
      },
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
      })),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${selectedConversationId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Exported',
      description: 'Conversation data downloaded as JSON',
    });
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.manual_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!checkingAdmin && !isAdmin && (
        <Alert>
          <AlertTitle>Admin Access Required</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>You need admin access to view all user conversations.</p>
            <Button onClick={grantAdminAccess} size="sm" className="w-fit">
              Grant Myself Admin Access
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            User Conversation History
          </CardTitle>
          <CardDescription>
            View all conversations for any user (Admin only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select User</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={loading.profiles ? "Loading users..." : "Choose a user..."} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.user_id}>
                    {profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUserId && (
            <>
              {/* Statistics Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{stats.totalConversations}</div>
                    <p className="text-xs text-muted-foreground">Total Conversations</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{stats.totalMessages}</div>
                    <p className="text-xs text-muted-foreground">Total Messages</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{stats.avgMessagesPerConv}</div>
                    <p className="text-xs text-muted-foreground">Avg Messages/Conv</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Conversations</h3>
                    {conversations.length > 0 && (
                      <Badge variant="secondary">{filteredConversations.length} of {conversations.length}</Badge>
                    )}
                  </div>
                  <div className="mb-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-96 border rounded-md p-4">
                    {loading.conversations ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : filteredConversations.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {searchQuery ? 'No matching conversations' : 'No conversations found'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredConversations.map((conv) => (
                          <div
                            key={conv.id}
                            onClick={() => setSelectedConversationId(conv.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedConversationId === conv.id
                                ? 'bg-primary/10 border-primary'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <div className="font-medium text-sm line-clamp-2">{conv.title}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(conv.created_at), 'MMM d, yyyy h:mm a')}
                            </div>
                            {conv.manual_id && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <FileText className="h-3 w-3" />
                                {conv.manual_id}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Messages</h3>
                    {selectedConversationId && messages.length > 0 && (
                      <Button size="sm" variant="outline" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-96 border rounded-md p-4">
                    {loading.messages ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : !selectedConversationId ? (
                      <p className="text-muted-foreground text-sm">Select a conversation to view messages</p>
                    ) : messages.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No messages in this conversation</p>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-lg ${
                              msg.role === 'user'
                                ? 'bg-primary/10 ml-4'
                                : 'bg-muted mr-4'
                            }`}
                          >
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              {msg.role === 'user' ? 'User' : 'Assistant'} •{' '}
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserConversationHistory;
