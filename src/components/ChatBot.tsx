import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { GameSidebar } from "@/components/GameSidebar";
import { DetailedFeedbackDialog } from "@/components/DetailedFeedbackDialog";
import { GameRequestDialog } from "@/components/GameRequestDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageCircle,
  Send,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  Lightbulb,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Save,
  History,
  Plus,
  Trash2,
  MessageSquarePlus,
  LogIn,
  Flag,
  X,
  MoreVertical,
  Edit,
  Clock,
  CheckCheck,
  XCircle,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface AnswerStep {
  step: string;
  expected?: string;
  source?: "manual" | "expert";
}

interface AnswerSource {
  page: number;
  note: string;
}

interface StructuredAnswer {
  summary: string;
  steps?: AnswerStep[];
  why?: string[];
  expert_advice?: string[];
  safety?: string[];
  sources?: AnswerSource[];
}

interface ChatMessage {
  id: string;
  type: "user" | "bot";
  content: string | StructuredAnswer;
  timestamp: Date;
  query_log_id?: string;
  feedback?: "thumbs_up" | "thumbs_down" | null;
  status?: "sending" | "sent" | "failed";
  thumbnails?: Array<{
    page_id: string;
    url: string;
    title: string;
  }>;
  manual_id?: string;
  manual_title?: string;
  pastMatches?: Array<{
    conversation_id: string;
    title: string;
    date: string;
    preview: string;
    solution: string;
  }>;
}

interface UsageInfo {
  queries_used: number;
  queries_remaining: number;
  queries_limit: number | null;
  limit_reached: boolean;
  is_authenticated: boolean;
  signup_required?: boolean;
  manual_override?: boolean;
}

interface ChatBotProps {
  selectedManualId?: string;
  manualTitle?: string;
  onUsageUpdate?: (usage: UsageInfo) => void;
}

interface Conversation {
  id: string;
  title: string;
  manual_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export function ChatBot({
  selectedManualId: initialManualId,
  manualTitle: initialManualTitle,
  onUsageUpdate,
}: ChatBotProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string | null>(initialManualId || null);
  const [manualTitle, setManualTitle] = useState<string | null>(initialManualTitle || null);
  const [expandedSources, setExpandedSources] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [savedConversations, setSavedConversations] = useState<any[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showLimitReached, setShowLimitReached] = useState(false);
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [selectedMessageForFeedback, setSelectedMessageForFeedback] = useState<ChatMessage | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [otherUsers, setOtherUsers] = useState<Array<{ user_id: string; email?: string; is_typing: boolean }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const GUEST_MESSAGE_LIMIT = 5;
  const [isInitialized, setIsInitialized] = useState(false);

  // Load guest message count from localStorage on mount
  useEffect(() => {
    if (!user) {
      const stored = localStorage.getItem("guest_message_count");
      setGuestMessageCount(stored ? parseInt(stored, 10) : 0);
    } else {
      setGuestMessageCount(0);
      localStorage.removeItem("guest_message_count");
    }
  }, [user]);

  // Detect manual scrolling
  // Set up presence tracking for the current conversation
  useEffect(() => {
    if (!currentConversationId || !user) return;

    const channel = supabase.channel(`conversation:${currentConversationId}`);
    presenceChannelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = Object.values(state)
          .flat()
          .filter((presence: any) => presence.user_id !== user.id)
          .map((presence: any) => ({
            user_id: presence.user_id,
            email: presence.email,
            is_typing: presence.is_typing || false,
          }));
        setOtherUsers(users);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("User joined:", newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("User left:", leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            email: user.email,
            is_typing: false,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentConversationId, user]);

  // Update typing status when user types
  useEffect(() => {
    if (!presenceChannelRef.current || !user) return;

    presenceChannelRef.current.track({
      user_id: user.id,
      email: user.email,
      is_typing: isTyping,
      online_at: new Date().toISOString(),
    });
  }, [isTyping, user]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsUserScrolling(!isAtBottom);
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled up
    if (!isUserScrolling) {
      scrollToBottom();
    }
  }, [messages, isUserScrolling]);

  const updateWelcomeMessage = () => {
    const welcomeMessage: ChatMessage = {
      id: "welcome",
      type: "bot",
      content: selectedManualId
        ? `Hello! I'm here to help you troubleshoot "${manualTitle}". What issue can I help you solve today?`
        : `Hello! I'm your arcade troubleshooting assistant. Please select a game from the sidebar to get started.`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  // Initial load - always start fresh with game selection
  useEffect(() => {
    const initializeChat = async () => {
      if (isInitialized) return;

      await loadConversations();

      // Only reset if no manual was passed as prop
      if (!initialManualId) {
        setSelectedManualId(null);
        setManualTitle(null);
        setCurrentConversationId(null);
        localStorage.removeItem("last_conversation_id");
      } else {
        // Use the prop values
        setSelectedManualId(initialManualId);
        setManualTitle(initialManualTitle);
      }
      updateWelcomeMessage();
      setIsInitialized(true);
    };

    initializeChat();
  }, [user]);

  // Sync manual selection from parent props
  useEffect(() => {
    if (isInitialized && initialManualId !== selectedManualId) {
      setSelectedManualId(initialManualId || null);
      setManualTitle(initialManualTitle || null);
    }
  }, [initialManualId, initialManualTitle, isInitialized]);

  // Update welcome message when manual changes (but only if no active conversation)
  useEffect(() => {
    if (isInitialized && messages.length <= 1) {
      updateWelcomeMessage();
    }
  }, [selectedManualId, manualTitle]);

  const loadConversations = async () => {
    if (!user) return; // Only load conversations for logged-in users

    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setConversations(data || []);
      setSavedConversations(data || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const loadSavedConversations = async () => {
    await loadConversations();
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase.from("conversations").delete().eq("id", conversationId);

      if (error) throw error;

      await loadConversations();

      if (currentConversationId === conversationId) {
        startNewConversation();
      }

      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed.",
      });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const { data: conversationData, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .single();

      if (convError) throw convError;

      const { data: messagesData, error: msgError } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (msgError) throw msgError;

      // Check if conversation has no messages
      if (!messagesData || messagesData.length === 0) {
        toast({
          title: "Empty Conversation",
          description: "This conversation has no saved messages yet.",
          variant: "destructive",
        });
        return;
      }

      const loadedMessages: ChatMessage[] = messagesData.map((msg) => ({
        id: msg.id,
        type: msg.role === "user" ? "user" : "bot",
        content: msg.content,
        timestamp: new Date(msg.created_at),
        query_log_id: msg.query_log_id || undefined,
        feedback: null,
      }));

      setMessages(loadedMessages);
      setCurrentConversationId(conversationId);
      setSelectedManualId(conversationData.manual_id);
      setShowConversations(false);
      setShowHistory(false);

      // Save as last active conversation
      localStorage.setItem("last_conversation_id", conversationId);

      toast({
        title: "Conversation loaded",
        description: conversationData.title,
      });
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive",
      });
    }
  };

  const renameConversation = async (conversationId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      toast({
        title: "Error",
        description: "Title cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("conversations")
        .update({ title: newTitle.trim() })
        .eq("id", conversationId);

      if (error) throw error;

      setConversations((prev) =>
        prev.map((conv) => (conv.id === conversationId ? { ...conv, title: newTitle.trim() } : conv)),
      );

      setEditingConversationId(null);
      setEditingTitle("");

      toast({
        title: "Renamed",
        description: "Conversation title updated",
      });
    } catch (error) {
      console.error("Error renaming conversation:", error);
      toast({
        title: "Error",
        description: "Failed to rename conversation",
        variant: "destructive",
      });
    }
  };

  const saveConversation = async () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    if (messages.length <= 1) {
      toast({
        title: "Nothing to save",
        description: "Have a conversation first",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const firstUserMessage = messages.find((m) => m.type === "user");
      const title = (typeof firstUserMessage?.content === "string" ? firstUserMessage.content : "Conversation").slice(
        0,
        50,
      );

      let conversationId = currentConversationId;

      if (!conversationId) {
        // Create new conversation
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert([
            {
              title,
              manual_id: selectedManualId,
              user_id: user.id,
            },
          ])
          .select()
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;
        setCurrentConversationId(conversationId);
      } else {
        // Update existing conversation
        await supabase.from("conversations").update({ title }).eq("id", conversationId);
      }

      // Save all messages
      const messagesToSave = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          conversation_id: conversationId,
          role: m.type === "user" ? "user" : "assistant",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          query_log_id: m.query_log_id || null,
        }));

      // Delete old messages and insert new ones
      await supabase.from("conversation_messages").delete().eq("conversation_id", conversationId);

      const { error: msgError } = await supabase.from("conversation_messages").insert(messagesToSave);

      if (msgError) throw msgError;

      await loadSavedConversations();

      toast({
        title: "Conversation saved",
        description: "You can access it anytime",
      });
    } catch (error) {
      console.error("Error saving conversation:", error);
      toast({
        title: "Error",
        description: "Failed to save conversation",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setSelectedManualId(null);
    setManualTitle(null);
    localStorage.removeItem("last_conversation_id");
    updateWelcomeMessage();
  };

  const handleManualChange = (newManualId: string | null, newManualTitle: string | null) => {
    // Show context switch notification if messages exist
    if (messages.length > 1) {
      toast({
        title: "🔄 Switched to new game",
        description: `Starting fresh conversation for: ${newManualTitle || "All Manuals"}`,
      });
    }

    // Clear current conversation and start fresh
    setMessages([]);
    setCurrentConversationId(null);
    setSelectedManualId(newManualId);
    setManualTitle(newManualTitle);
    localStorage.removeItem("last_conversation_id");

    // Set up welcome message for new manual
    setTimeout(() => updateWelcomeMessage(), 0);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Clear typing indicator
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Require game selection before sending message
    if (!selectedManualId) {
      toast({
        title: "Please select a game first",
        description: "Choose which game you need help with from the dropdown above",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    // Check guest user message limit
    if (!user && guestMessageCount >= GUEST_MESSAGE_LIMIT) {
      setShowLimitReached(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    // Auto-save conversation when user sends first message
    let conversationIdToUse = currentConversationId;
    if (user && !currentConversationId && messages.length === 1) {
      const title = query.slice(0, 50);
      try {
        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert([
            {
              title,
              manual_id: selectedManualId,
              user_id: user.id,
            },
          ])
          .select()
          .single();

        if (!error && newConv) {
          conversationIdToUse = newConv.id;
          setCurrentConversationId(newConv.id);
          localStorage.setItem("last_conversation_id", newConv.id);
        }
      } catch (err) {
        console.error("Failed to create conversation:", err);
      }
    }

    // Increment guest message count
    if (!user) {
      const newCount = guestMessageCount + 1;
      setGuestMessageCount(newCount);
      localStorage.setItem("guest_message_count", newCount.toString());
    }

    // Create placeholder bot message
    const botMessageId = (Date.now() + 1).toString();
    const botMessage: ChatMessage = {
      id: botMessageId,
      type: "bot",
      content: "",
      timestamp: new Date(),
      feedback: null,
    };
    setMessages((prev) => [...prev, botMessage]);

    try {
      // Build conversation history for context
      const conversationHistory = messages
        .filter((m) => m.type === "user" || m.type === "bot")
        .map((m) => ({
          role: m.type === "user" ? "user" : "assistant",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }));

      console.log("📤 Sending streaming message to chat-manual:", {
        query,
        manual_id: selectedManualId,
        manual_title: manualTitle,
        history_length: conversationHistory.length,
      });

      // Validate manual_id before sending
      if (selectedManualId) {
        console.log("✅ Manual filter ACTIVE:", selectedManualId);
      } else {
        console.log("⚠️ No manual filter - searching ALL manuals");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          query,
          manual_id: selectedManualId ?? null,
          stream: true,
          messages: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "content") {
                // Ensure data is always a string
                const contentChunk = typeof parsed.data === "string" ? parsed.data : JSON.stringify(parsed.data);
                accumulatedContent += contentChunk;
                setMessages((prev) =>
                  prev.map((msg) => (msg.id === botMessageId ? { ...msg, content: accumulatedContent } : msg)),
                );
              } else if (parsed.type === "metadata") {
                console.log("📊 Received metadata:", parsed.data);

                // Handle usage info
                if (parsed.data?.usage) {
                  onUsageUpdate?.(parsed.data.usage);
                }

                // 🔥 LAYER 3: Auto-set manual when detected
                if (parsed.data.auto_detected && parsed.data.manual_id && parsed.data.detected_manual_title) {
                  const detectedId = parsed.data.manual_id;
                  const detectedTitle = parsed.data.detected_manual_title;

                  // Only auto-set if different from current selection
                  if (detectedId !== selectedManualId) {
                    setSelectedManualId(detectedId);
                    setManualTitle(detectedTitle);
                    toast({
                      title: "🔄 Manual Auto-Detected",
                      description: `Switched to: ${detectedTitle}`,
                      duration: 4000,
                    });
                    console.log(`✅ Auto-set manual: ${detectedTitle} (${detectedId})`);
                  } else {
                    toast({
                      title: "Manual Confirmed",
                      description: `Searching in: ${detectedTitle}`,
                      duration: 3000,
                    });
                  }
                }

                // Store metadata including thumbnails and manual_id
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? {
                          ...msg,
                          thumbnails: parsed.data?.thumbnails,
                          manual_id: parsed.data?.manual_id,
                          manual_title: parsed.data?.manual_title,
                        }
                      : msg,
                  ),
                );
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }

      console.log("✅ Streaming complete");

      // Mark user message as sent
      setMessages((prev) => prev.map((msg) => (msg.id === userMessage.id ? { ...msg, status: "sent" as const } : msg)));

      // Auto-save message after completion for logged-in users
      if (user && conversationIdToUse) {
        try {
          await supabase.from("conversation_messages").insert([
            {
              conversation_id: conversationIdToUse,
              role: "user",
              content: query,
            },
            {
              conversation_id: conversationIdToUse,
              role: "assistant",
              content: accumulatedContent,
            },
          ]);

          // Update last_message_at timestamp
          await supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationIdToUse);

          // Save as last active conversation
          localStorage.setItem("last_conversation_id", conversationIdToUse);
        } catch (err) {
          console.error("Failed to auto-save messages:", err);
        }
      }
    } catch (err: any) {
      console.error("❌ chat-manual failed:", err);

      // Mark user message as failed
      setMessages((prev) =>
        prev.map((msg) => (msg.id === userMessage.id ? { ...msg, status: "failed" as const } : msg)),
      );

      toast({
        title: "Error",
        description: err.message || "Failed to process your question. Please try again.",
        variant: "destructive",
      });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                content: `Error: ${err.message || "I hit an error talking to the assistant. Please try again."}`,
              }
            : msg,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFeedback = async (messageId: string, rating: "thumbs_up" | "thumbs_down") => {
    const message = messages.find((m) => m.id === messageId);
    if (!message || message.type !== "bot" || !message.query_log_id) return;

    try {
      const { error } = await supabase.from("model_feedback").insert({
        query_log_id: message.query_log_id,
        rating: rating === "thumbs_up" ? "excellent" : "poor",
        model_type: "manual_troubleshooting",
        actual_answer: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
      });

      if (error) throw error;

      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, feedback: rating } : msg)));

      toast({
        title: "Feedback recorded",
        description:
          rating === "thumbs_up"
            ? "Thanks for the positive feedback!"
            : "Thanks for the feedback, we'll work to improve.",
      });
    } catch (error) {
      console.error("Error saving feedback:", error);
      toast({
        title: "Error",
        description: "Failed to save feedback",
        variant: "destructive",
      });
    }
  };

  const isStructuredAnswer = (content: any): content is StructuredAnswer => {
    return typeof content === "object" && content !== null && "summary" in content;
  };

  const renderStructuredAnswer = (answer: StructuredAnswer, messageId: string) => (
    <div className="space-y-3">
      {/* Summary */}
      <div className="text-sm leading-relaxed">{answer.summary}</div>

      {/* Steps as Checklist */}
      {answer.steps && answer.steps.length > 0 && (
        <div className="space-y-2">
          <div className="font-semibold text-xs text-primary uppercase tracking-wider">Procedure</div>
          {answer.steps.map((stepItem, i) => (
            <div key={i} className="flex gap-2 items-start">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-sm">{stepItem.step}</span>
                  {stepItem.source && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        stepItem.source === "manual"
                          ? "bg-green-500/10 text-green-500 border-green-500/30"
                          : "bg-primary/10 text-primary border-primary/30"
                      }`}
                    >
                      {stepItem.source}
                    </Badge>
                  )}
                </div>
                {stepItem.expected && (
                  <div className="text-xs text-muted-foreground">Expected: {stepItem.expected}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Why Explanation */}
      {answer.why && answer.why.length > 0 && (
        <div className="space-y-2">
          <div className="font-semibold text-xs text-primary uppercase tracking-wider">Why This Works</div>
          {answer.why.map((reason, i) => (
            <div key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/20">
              {reason}
            </div>
          ))}
        </div>
      )}

      {/* Expert Advice / Pro Tips */}
      {answer.expert_advice && answer.expert_advice.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-primary uppercase tracking-wider">
            <Lightbulb className="h-4 w-4" />
            Pro Tips
          </div>
          {answer.expert_advice.map((tip, i) => (
            <div key={i} className="text-sm">
              • {tip}
            </div>
          ))}
        </div>
      )}

      {/* Safety Warnings */}
      {answer.safety && answer.safety.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-primary uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4" />
            Safety
          </div>
          {answer.safety.map((warning, i) => (
            <div key={i} className="text-sm">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      {/* Sources Toggle */}
      {answer.sources && answer.sources.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setExpandedSources(expandedSources === messageId ? null : messageId)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {expandedSources === messageId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <FileText size={14} />
            View Sources ({answer.sources.length})
          </button>

          {expandedSources === messageId && (
            <div className="mt-2 space-y-2">
              {answer.sources.map((source, i) => (
                <div key={i} className="text-xs p-2 bg-background/50 rounded border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      Page {source.page}
                    </Badge>
                    <span className="text-muted-foreground">{source.note}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const exportConversation = () => {
    const exportData = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.type === "user" ? "User" : "Assistant",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content, null, 2),
        timestamp: m.timestamp.toLocaleString(),
      }));

    const exportText = exportData.map((m) => `[${m.timestamp}] ${m.role}:\n${m.content}\n`).join("\n---\n\n");

    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Conversation exported",
      description: "Your conversation has been downloaded as a text file.",
    });
  };

  const generateSummary = async () => {
    if (messages.length <= 1) {
      toast({
        title: "Not enough content",
        description: "Have a conversation first to generate a summary.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const conversationText = messages
        .filter((m) => m.id !== "welcome")
        .map(
          (m) =>
            `${m.type === "user" ? "User" : "Assistant"}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`,
        )
        .join("\n\n");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          query: `Please provide a concise summary report of this conversation, highlighting: 1) Main issues discussed, 2) Key solutions provided, 3) Important technical details mentioned, 4) Any unresolved items:\n\n${conversationText}`,
          manual_id: selectedManualId ?? null,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();
      const summaryMessage: ChatMessage = {
        id: Date.now().toString(),
        type: "bot",
        content: `📊 **Conversation Summary**\n\n${data.response || data.content || "Summary generated."}`,
        timestamp: new Date(),
        feedback: null,
      };

      setMessages((prev) => [...prev, summaryMessage]);
      toast({
        title: "Summary generated",
        description: "AI has summarized the conversation.",
      });
    } catch (error) {
      console.error("Summary generation failed:", error);
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* Main Chat Area */}
      <Card className="tech-card h-full flex flex-col w-full rounded-none border-0 bg-black">
        <CardHeader className="border-b border-white/10 flex-shrink-0 py-3 px-6">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-3">
              <span className="tracking-wider font-bold text-white font-tech">LEVEL UP</span>
              {selectedManualId && manualTitle && (
                <Badge className="bg-orange/20 text-orange border-orange/30 text-xs">{manualTitle}</Badge>
              )}
              {!user && (
                <Badge variant="outline" className="text-xs border-white/20 text-muted-foreground">
                  {GUEST_MESSAGE_LIMIT - guestMessageCount} free questions left
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={saveConversation}
                    disabled={messages.length <= 1 || isSaving}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-50"
                    title="Save conversation"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Sheet open={showHistory} onOpenChange={setShowHistory}>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
                        title="View conversation history"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto bg-black border-white/10">
                      <SheetHeader>
                        <SheetTitle className="font-tech text-white">CONVERSATION HISTORY</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6 space-y-3">
                        {conversations.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">No saved conversations yet</div>
                        ) : (
                          conversations.map((conv) => (
                            <Card
                              key={conv.id}
                              className={`hover:border-orange/50 transition-colors bg-white/5 border-white/10 ${
                                currentConversationId === conv.id ? "border-orange/50" : ""
                              }`}
                            >
                              <CardContent className="pt-4 pb-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 cursor-pointer" onClick={() => loadConversation(conv.id)}>
                                    {editingConversationId === conv.id ? (
                                      <Input
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            renameConversation(conv.id, editingTitle);
                                          } else if (e.key === "Escape") {
                                            setEditingConversationId(null);
                                            setEditingTitle("");
                                          }
                                        }}
                                        onBlur={() => {
                                          if (editingTitle.trim()) {
                                            renameConversation(conv.id, editingTitle);
                                          } else {
                                            setEditingConversationId(null);
                                            setEditingTitle("");
                                          }
                                        }}
                                        className="text-white bg-white/10"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <div className="font-medium mb-1 line-clamp-2 text-white">{conv.title}</div>
                                    )}
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(conv.last_message_at).toLocaleDateString()} at{" "}
                                      {new Date(conv.last_message_at).toLocaleTimeString()}
                                    </div>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingConversationId(conv.id);
                                          setEditingTitle(conv.title);
                                        }}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Rename
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConversationToDelete(conv.id);
                                          setShowDeleteDialog(true);
                                        }}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              )}
            </div>
          </CardTitle>
          {currentConversationId && (
            <div className="mt-2">
              <Badge variant="outline" className="text-sm px-3 py-1 bg-white/5 text-muted-foreground border-white/10">
                Saved conversation
              </Badge>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          {/* Saved Conversations Sidebar */}
          {showConversations && (
            <div className="border-b border-border p-6 space-y-2 max-h-[200px] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-base">Saved Conversations</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowConversations(false)}>
                  ✕
                </Button>
              </div>
              {savedConversations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved conversations</p>
              ) : (
                savedConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="flex items-start justify-between gap-2 p-2 rounded hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{conv.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(conv.last_message_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await supabase.from("conversations").delete().eq("id", conv.id);
                          await loadSavedConversations();
                          if (currentConversationId === conv.id) {
                            startNewConversation();
                          }
                          toast({ title: "Conversation deleted" });
                        } catch (error) {
                          toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Messages Area */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-6 px-6 space-y-6 min-h-0 w-full bg-black">
            {/* Other users viewing indicator */}
            {otherUsers.length > 0 && (
              <div className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>
                  {otherUsers.length} other {otherUsers.length === 1 ? "user" : "users"} viewing
                  {otherUsers.some((u) => u.is_typing) && (
                    <span className="ml-2 text-orange">• {otherUsers.filter((u) => u.is_typing).length} typing...</span>
                  )}
                </span>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`w-full rounded-lg p-5 font-sans text-white ${
                    message.type === "user"
                      ? "bg-white/[0.05] border border-primary/40 hover:bg-white/[0.07]"
                      : "bg-white/[0.02] border-l-4 border-l-primary/50"
                  }`}
                >
                  {message.type === "user" && (
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <User className="h-5 w-5" />
                        <span className="text-sm opacity-70">{message.timestamp.toLocaleTimeString()}</span>
                      </div>
                      {message.status && (
                        <div className="flex items-center space-x-1">
                          {message.status === "sending" && (
                            <>
                              <Clock className="h-4 w-4 opacity-70" />
                              <span className="text-xs opacity-70">Sending...</span>
                            </>
                          )}
                          {message.status === "sent" && (
                            <>
                              <CheckCheck className="h-4 w-4 opacity-70" />
                              <span className="text-xs opacity-70">Sent</span>
                            </>
                          )}
                          {message.status === "failed" && (
                            <>
                              <XCircle className="h-4 w-4 text-red-400" />
                              <span className="text-xs text-red-400">Failed</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {message.type === "user" ? (
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content as string}</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Bot className="h-5 w-5" />
                          <span className="text-xs opacity-70">{message.timestamp.toLocaleTimeString()}</span>
                        </div>
                        {!message.content && (
                          <div className="flex items-center space-x-1">
                            <Loader2 className="h-4 w-4 animate-spin opacity-70" />
                            <span className="text-xs opacity-70">Typing...</span>
                          </div>
                        )}
                      </div>
                      {isStructuredAnswer(message.content) ? (
                        renderStructuredAnswer(message.content, message.id)
                      ) : (
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">
                          {typeof message.content === "string" ? message.content : JSON.stringify(message.content)}
                        </div>
                      )}
                    </>
                  )}

                  {/* Manual Source Info */}
                  {message.type === "bot" && message.manual_id && (
                    <div className="mt-4 pt-4 border-t border-primary/10">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Source: {message.manual_title || message.manual_id}</span>
                      </div>
                    </div>
                  )}

                  {/* Display thumbnails/images */}
                  {message.type === "bot" && message.thumbnails && message.thumbnails.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-primary/10">
                      <div className="text-sm font-semibold text-primary mb-3">Reference Images</div>
                      <div className="grid grid-cols-2 gap-4">
                        {message.thumbnails.map((thumb, idx) => (
                          <div key={idx} className="tech-card bg-background/50 overflow-hidden">
                            <img
                              src={thumb.url}
                              alt={thumb.title}
                              className="w-full h-auto object-contain bg-background/20"
                              onError={(e) => {
                                e.currentTarget.src =
                                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23888"%3EImage unavailable%3C/text%3E%3C/svg%3E';
                              }}
                            />
                            <div className="p-3 text-xs text-muted-foreground">{thumb.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Thumbs Up/Down + Report Issue for Bot Messages */}
                  {message.type === "bot" && (
                    <div className="mt-4 pt-4 border-t border-primary/10 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground mr-2">Was this helpful?</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFeedback(message.id, "thumbs_up")}
                          disabled={message.feedback !== null}
                          className={`h-9 px-4 ${
                            message.feedback === "thumbs_up"
                              ? "bg-green-500/20 text-green-500 border border-green-500/30"
                              : "hover:bg-green-500/10 hover:text-green-500"
                          }`}
                        >
                          <ThumbsUp className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFeedback(message.id, "thumbs_down")}
                          disabled={message.feedback !== null}
                          className={`h-9 px-4 ${
                            message.feedback === "thumbs_down"
                              ? "bg-red-500/20 text-red-500 border border-red-500/30"
                              : "hover:bg-red-500/10 hover:text-red-500"
                          }`}
                        >
                          <ThumbsDown className="h-5 w-5" />
                        </Button>
                      </div>

                      {/* Report Issue Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedMessageForFeedback(message);
                          setFeedbackDialogOpen(true);
                        }}
                        className="h-8 text-xs hover:bg-orange-500/10 hover:text-orange-500 hover:border-orange-500/30"
                      >
                        <Flag className="h-3 w-3 mr-1" />
                        Report an Issue
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg p-5 border border-primary/30" style={{ background: "hsl(210 33% 9%)" }}>
                  <div className="flex items-center space-x-3">
                    <Bot className="h-5 w-5 text-primary" />
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-base text-white">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border py-5 px-6 flex-shrink-0 w-full">
            <>
              <div className="flex space-x-3">
                <Input
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);

                    // Set typing indicator
                    setIsTyping(true);

                    // Clear existing timeout
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                    }

                    // Clear typing after 2 seconds of no typing
                    typingTimeoutRef.current = setTimeout(() => {
                      setIsTyping(false);
                    }, 2000);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedManualId
                      ? "Ask me about arcade machine troubleshooting..."
                      : "Select a manual from the sidebar to start asking questions"
                  }
                  disabled={isLoading || !selectedManualId}
                  className="flex-1 text-base h-12"
                />
                {messages.length > 1 && (
                  <Button
                    onClick={startNewConversation}
                    variant="ghost"
                    size="lg"
                    className="h-12 px-4"
                    title="Clear chat (keeps history saved)"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading || !selectedManualId}
                  size="lg"
                  variant="orange"
                  className="h-12 px-6"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
              <div className="text-sm text-muted-foreground mt-3 flex items-center justify-between">
                <span>Press Enter to send • Shift+Enter for new line</span>
                {!user && (
                  <span className="text-orange-500 font-medium">
                    {guestMessageCount}/{GUEST_MESSAGE_LIMIT} free questions used
                  </span>
                )}
              </div>
            </>
          </div>
        </CardContent>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the conversation and all its messages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (conversationToDelete) {
                    deleteConversation(conversationToDelete);
                    setConversationToDelete(null);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showLimitReached} onOpenChange={setShowLimitReached}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Free Question Limit Reached
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>You've used all {GUEST_MESSAGE_LIMIT} free questions. To continue getting AI assistance:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Create an account</li>
                  <li>Choose a plan that fits your needs</li>
                </ol>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => navigate("/auth")}>Sign Up Now</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Detailed Feedback Dialog */}
        <DetailedFeedbackDialog
          open={feedbackDialogOpen}
          onOpenChange={setFeedbackDialogOpen}
          queryLogId={selectedMessageForFeedback?.query_log_id}
          manualId={selectedMessageForFeedback?.manual_id}
          queryText={
            messages.find(
              (m) => m.type === "user" && messages.indexOf(m) === messages.indexOf(selectedMessageForFeedback!) - 1,
            )?.content as string
          }
        />
      </Card>
    </div>
  );
}
