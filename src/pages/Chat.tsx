import { useState, useEffect } from 'react';
import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';
import { UsageBanner } from '@/components/UsageBanner';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageSquare, MessageSquarePlus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface UsageInfo {
  queries_used: number;
  queries_remaining: number;
  queries_limit: number | null;
  limit_reached: boolean;
  is_authenticated: boolean;
  signup_required?: boolean;
  manual_override?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  manual_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

const Chat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Listen for usage updates from ChatBot
  useEffect(() => {
    const handleUsageUpdate = (event: CustomEvent<UsageInfo>) => {
      setUsageInfo(event.detail);
    };

    window.addEventListener('usage-update' as any, handleUsageUpdate);
    return () => {
      window.removeEventListener('usage-update' as any, handleUsageUpdate);
    };
  }, []);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    
    const loadConversations = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setConversations(data);
      }
    };

    loadConversations();
  }, [user, refreshTrigger]);

  const handleNewConversation = () => {
    setSelectedConversationId(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLoadConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      if (selectedConversationId === conversationId) {
        handleNewConversation();
      }

      setRefreshTrigger(prev => prev + 1);
      
      toast({
        title: 'Conversation deleted',
        description: 'The conversation has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen mesh-gradient flex w-full">
        {user && (
          <Sidebar className="border-r border-border/50">
            <div className="p-4 border-b border-border/50">
              <Button
                onClick={handleNewConversation}
                className="w-full"
                variant="default"
              >
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                New Conversation
              </Button>
            </div>
            
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Recent Conversations</SidebarGroupLabel>
                <SidebarGroupContent>
                  <ScrollArea className="h-[calc(100vh-200px)]">
                    <SidebarMenu>
                      {conversations.map((conv) => (
                        <SidebarMenuItem key={conv.id}>
                          <SidebarMenuButton
                            onClick={() => handleLoadConversation(conv.id)}
                            className={`w-full justify-start ${
                              selectedConversationId === conv.id ? 'bg-muted' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between w-full gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate text-sm font-medium">
                                    {conv.title}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={(e) => handleDeleteConversation(conv.id, e)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </ScrollArea>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center h-14 px-4">
              {user && <SidebarTrigger className="mr-4" />}
              <SharedHeader title="AI Assistant" showBackButton={true} />
            </div>
          </div>
          
          <main className="flex-1 container mx-auto px-4 py-4 flex flex-col">
            {usageInfo && !usageInfo.manual_override && (
              <UsageBanner
                queriesUsed={usageInfo.queries_used}
                queriesRemaining={usageInfo.queries_remaining}
                queriesLimit={usageInfo.queries_limit}
                isAuthenticated={usageInfo.is_authenticated}
                limitReached={usageInfo.limit_reached}
                signupRequired={usageInfo.signup_required}
              />
            )}
            <div className="flex-1 min-h-0">
              <ChatBot 
                key={refreshTrigger}
                onUsageUpdate={setUsageInfo}
              />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
