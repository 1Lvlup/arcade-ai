import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { GameSidebar } from "@/components/GameSidebar";
import { DetailedFeedbackDialog } from "@/components/DetailedFeedbackDialog";
import { GameRequestDialog } from "@/components/GameRequestDialog";
import { InteractiveComponentLibrary } from "@/components/InteractiveComponentLibrary";
import { InteractiveComponentRenderer } from "@/components/InteractiveComponentRenderer";
import { DiagnosticWizard } from "@/components/DiagnosticWizard";
import { RAGDebugPanel } from "@/components/RAGDebugPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Download,
  FileDown,
  Paperclip,
  ImageIcon,
  Zap,
  ZapOff,
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

type InteractiveComponentType = "button_group" | "checklist" | "form" | "code" | "progress" | "status";

interface InteractiveComponent {
  id: string;
  type: InteractiveComponentType;
  data: any;
}

interface ComponentInteraction {
  componentId: string;
  type: string;
  value: any;
  timestamp: Date;
}

interface StructuredAnswer {
  summary: string;
  steps?: AnswerStep[];
  why?: string[];
  expert_advice?: string[];
  safety?: string[];
  sources?: AnswerSource[];
  interactive_components?: InteractiveComponent[];
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
  images?: string[];
  image_analysis?: {
    description: string;
    detected_issues: string[];
    suggested_actions: string[];
  };
  interactiveComponents?: InteractiveComponent[];
  rag_debug?: {
    chunks: Array<{
      content_preview: string;
      page_start: number;
      page_end: number;
      score: number;
      rerank_score: number;
      menu_path: string;
    }>;
    signals: {
      topScore: number;
      avgTop3: number;
      strongHits: number;
    };
    quality_score: number;
    max_rerank_score: number;
    max_base_score: number;
    performance: {
      search_ms: string;
      generation_ms: string;
      total_ms: string;
    };
    answer_style: {
      is_weak: boolean;
      adaptive_mode: string;
    };
    strategy?: string;
  };
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
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
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
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [componentInteractions, setComponentInteractions] = useState<Map<string, any>>(new Map());
  const [formValues, setFormValues] = useState<Map<string, Record<string, any>>>(new Map());
  const [availableGames, setAvailableGames] = useState<Array<{ manual_id: string; canonical_title: string }>>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Streaming and debug mode settings
  const [useStreaming, setUseStreaming] = useState(() => {
    const saved = localStorage.getItem('chatStreamingMode');
    return saved ? JSON.parse(saved) : true;
  });
  const [debugMode, setDebugMode] = useState(() => {
    const saved = localStorage.getItem('chatDebugMode');
    return saved ? JSON.parse(saved) : false;
  });

  const GUEST_MESSAGE_LIMIT = 10;
  const [isInitialized, setIsInitialized] = useState(false);

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 0 && currentConversationId) {
      localStorage.setItem(`chat_messages_${currentConversationId}`, JSON.stringify(messages));
    }
  }, [messages, currentConversationId]);

  // Restore messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      const stored = localStorage.getItem(`chat_messages_${currentConversationId}`);
      if (stored) {
        try {
          const parsedMessages = JSON.parse(stored);
          // Convert timestamp strings back to Date objects
          const restoredMessages = parsedMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(restoredMessages);
        } catch (e) {
          console.error('Failed to restore messages:', e);
        }
      }
    }
  }, [currentConversationId]);

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
        ? `I'm your tech assistant for ${manualTitle}. Tell me exactly what the game is doing, and I'll walk you to a fix step-by-step.`
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

  // Sync manual selection from parent props and auto-start new conversation
  useEffect(() => {
    if (isInitialized && initialManualId !== selectedManualId) {
      // If manual changes, automatically start a new conversation
      handleManualChange(initialManualId || null, initialManualTitle || null);
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

  // Load available games for export
  useEffect(() => {
    const loadGames = async () => {
      try {
        const { data, error } = await supabase
          .from("manual_metadata")
          .select("manual_id, canonical_title")
          .order("canonical_title");

        if (!error && data) {
          setAvailableGames(data);
        }
      } catch (error) {
        console.error("Error loading games:", error);
      }
    };
    loadGames();
  }, []);

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
          content: m.content as string,
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
    const newConvId = null;
    setMessages([]);
    setCurrentConversationId(newConvId);
    setSelectedManualId(null);
    setManualTitle(null);
    localStorage.removeItem("last_conversation_id");
    // Clear persisted messages for old conversation
    if (currentConversationId) {
      localStorage.removeItem(`chat_messages_${currentConversationId}`);
    }
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

    // Clear persisted messages for old conversation
    if (currentConversationId) {
      localStorage.removeItem(`chat_messages_${currentConversationId}`);
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

  const exportConversation = () => {
    const conversationTitle = manualTitle || "General Conversation";
    const exportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Build HTML content matching exact UI styles
    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${conversationTitle} - Conversation Export</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: hsl(0, 0%, 0%);
      color: hsl(0, 0%, 100%);
      display: flex;
      height: 100vh;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .sidebar {
      width: 280px;
      background: hsl(0, 0%, 6%);
      border-right: 1px solid hsl(0, 0%, 20%);
      padding: 20px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: hsl(0, 0%, 30%) transparent;
    }
    .sidebar::-webkit-scrollbar {
      width: 6px;
    }
    .sidebar::-webkit-scrollbar-track {
      background: transparent;
    }
    .sidebar::-webkit-scrollbar-thumb {
      background: hsl(0, 0%, 30%);
      border-radius: 3px;
    }
    .sidebar h2 {
      font-size: 14px;
      color: hsl(0, 0%, 64%);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .game-item {
      padding: 10px 12px;
      margin-bottom: 4px;
      border-radius: 6px;
      font-size: 14px;
      color: hsl(0, 0%, 98%);
      background: hsl(0, 0%, 12%);
      border: 1px solid hsl(0, 0%, 15%);
      transition: all 0.2s ease;
    }
    .game-item:hover {
      border-color: hsl(24, 100%, 60%, 0.5);
    }
    .game-item.active {
      background: linear-gradient(135deg, hsla(24, 100%, 60%, 0.1), hsla(24, 100%, 60%, 0.05));
      border-color: hsl(24, 100%, 60%);
      color: hsl(0, 0%, 100%);
      font-weight: 500;
    }
    .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .chat-header {
      background: hsl(0, 0%, 0%);
      border-bottom: 1px solid hsla(0, 0%, 100%, 0.1);
      padding: 12px 24px;
    }
    .chat-header h1 {
      font-size: 16px;
      color: hsl(0, 0%, 100%);
      margin-bottom: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: bold;
      letter-spacing: 0.05em;
    }
    .chat-header .badge {
      background: hsla(24, 100%, 60%, 0.2);
      color: hsl(24, 100%, 60%);
      border: 1px solid hsla(24, 100%, 60%, 0.3);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: normal;
    }
    .chat-header .subtitle {
      font-size: 13px;
      color: hsl(0, 0%, 64%);
      margin-top: 4px;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      background: hsl(0, 0%, 0%);
      scrollbar-width: thin;
      scrollbar-color: hsl(0, 0%, 30%) transparent;
    }
    .messages::-webkit-scrollbar {
      width: 6px;
    }
    .messages::-webkit-scrollbar-track {
      background: transparent;
    }
    .messages::-webkit-scrollbar-thumb {
      background: hsl(0, 0%, 30%);
      border-radius: 3px;
    }
    .message {
      margin-bottom: 24px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .message-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 16px;
    }
    .user-icon {
      background: hsl(217, 91%, 60%);
      color: white;
    }
    .bot-icon {
      background: linear-gradient(135deg, hsl(24, 100%, 60%), hsl(24, 100%, 45%));
      color: white;
    }
    .message-content {
      flex: 1;
      max-width: 800px;
    }
    .message-text {
      background: hsl(0, 0%, 6%);
      padding: 12px 16px;
      border-radius: 8px;
      line-height: 1.6;
      color: hsl(0, 0%, 98%);
      border: 1px solid hsl(0, 0%, 20%);
    }
    .message.user .message-text {
      background: hsl(0, 0%, 6%);
      border-color: hsl(0, 0%, 20%);
    }
    .message.bot .message-text {
      background: hsl(0, 0%, 6%);
      border-color: hsl(0, 0%, 20%);
    }
    .timestamp {
      font-size: 11px;
      color: hsl(0, 0%, 45%);
      margin-top: 6px;
      font-weight: 400;
    }
    .structured-answer {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .summary {
      font-size: 14px;
      line-height: 1.6;
    }
    .section-title {
      font-size: 11px;
      color: hsl(24, 100%, 60%);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .step-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .step-icon {
      color: hsl(24, 100%, 60%);
      margin-top: 2px;
      flex-shrink: 0;
    }
    .step-content {
      flex: 1;
      font-size: 14px;
    }
    .step-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      margin-left: 8px;
      font-weight: 500;
    }
    .badge-manual {
      background: hsla(142, 76%, 45%, 0.1);
      color: hsl(142, 76%, 45%);
      border: 1px solid hsla(142, 76%, 45%, 0.3);
    }
    .badge-expert {
      background: hsla(24, 100%, 60%, 0.1);
      color: hsl(24, 100%, 60%);
      border: 1px solid hsla(24, 100%, 60%, 0.3);
    }
    .expected {
      font-size: 12px;
      color: hsl(0, 0%, 64%);
      margin-top: 4px;
    }
    .why-item {
      font-size: 14px;
      color: hsl(0, 0%, 64%);
      padding-left: 16px;
      border-left: 2px solid hsla(24, 100%, 60%, 0.2);
      margin-bottom: 8px;
    }
    .tip-box, .safety-box {
      background: hsla(24, 100%, 60%, 0.05);
      border: 1px solid hsla(24, 100%, 60%, 0.2);
      border-radius: 8px;
      padding: 12px;
      margin-top: 8px;
    }
    .tip-header, .safety-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: hsl(24, 100%, 60%);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .tip-item, .safety-item {
      font-size: 14px;
      margin-bottom: 4px;
    }
    .sources-section {
      border-top: 1px solid hsl(0, 0%, 20%);
      padding-top: 12px;
      margin-top: 12px;
    }
    .sources-toggle {
      font-size: 12px;
      color: hsl(0, 0%, 64%);
      cursor: pointer;
    }
    .source-item {
      font-size: 12px;
      padding: 8px;
      background: hsla(0, 0%, 100%, 0.02);
      border-radius: 6px;
      border: 1px solid hsl(0, 0%, 20%);
      margin-top: 8px;
    }
    .source-page {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      background: hsl(0, 0%, 12%);
      border: 1px solid hsl(0, 0%, 20%);
      font-size: 11px;
      margin-right: 8px;
    }
    .export-footer {
      background: hsl(0, 0%, 0%);
      border-top: 1px solid hsl(0, 0%, 20%);
      padding: 16px 24px;
      text-align: center;
      font-size: 12px;
      color: hsl(0, 0%, 45%);
    }
    .image-reference {
      margin-top: 12px;
      padding: 12px;
      background: hsl(0, 0%, 6%);
      border: 1px solid hsl(0, 0%, 20%);
      border-radius: 6px;
    }
    .image-reference-title {
      font-size: 11px;
      color: hsl(0, 0%, 64%);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .image-thumbnail {
      display: inline-block;
      margin: 4px;
      padding: 6px 10px;
      background: hsl(0, 0%, 12%);
      border: 1px solid hsl(0, 0%, 20%);
      border-radius: 4px;
      font-size: 12px;
      color: hsl(0, 0%, 98%);
    }
    @media print {
      body { background: white; color: black; }
      .sidebar { background: #f5f5f5; }
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <h2>Available Games (${availableGames.length})</h2>
    ${availableGames
      .map(
        (game) => `
      <div class="game-item ${game.manual_id === selectedManualId ? "active" : ""}">
        ${game.canonical_title}
      </div>
    `,
      )
      .join("")}
  </div>
  
  <div class="chat-container">
    <div class="chat-header">
      <h1>
        LEVEL UP
        ${manualTitle ? `<span class="badge">${manualTitle}</span>` : ""}
      </h1>
      <div class="subtitle">Exported on ${exportDate}</div>
    </div>
    
    <div class="messages">
      ${messages
        .map((msg) => {
          const time = msg.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          // Render plain markdown content with proper line breaks
          const contentHtml = (msg.content as string).replace(/\n/g, "<br>");

          return `
          <div class="message ${msg.type}">
            <div class="message-icon ${msg.type}-icon">
              ${msg.type === "user" ? "👤" : "🤖"}
            </div>
            <div class="message-content">
              <div class="message-text">${contentHtml}</div>
              <div class="timestamp">${time}</div>
              ${
                msg.thumbnails && msg.thumbnails.length > 0
                  ? `
                <div class="image-reference">
                  <div class="image-reference-title">Referenced Images:</div>
                  ${msg.thumbnails
                    .map(
                      (thumb) => `
                    <span class="image-thumbnail">📄 ${thumb.title}</span>
                  `,
                    )
                    .join("")}
                </div>
              `
                  : ""
              }
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
    
    <div class="export-footer">
      Exported from 1LevelUp AI Assistant • ${messages.length} messages
    </div>
  </div>
</body>
</html>
    `;

    // Create and download the file
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${conversationTitle.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Conversation exported",
      description: "Your conversation has been saved as an HTML file",
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    // Validate files
    for (const file of fileArray) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image file`,
          variant: "destructive",
        });
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB limit`,
          variant: "destructive",
        });
        continue;
      }

      validFiles.push(file);
    }

    if (selectedImages.length + validFiles.length > 4) {
      toast({
        title: "Too many images",
        description: "You can upload maximum 4 images per message",
        variant: "destructive",
      });
      return;
    }

    setSelectedImages((prev) => [...prev, ...validFiles]);

    // Create preview URLs
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrls((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImagesToStorage = async (files: File[]): Promise<string[]> => {
    if (!user) {
      throw new Error("Must be logged in to upload images");
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { data, error } = await supabase.storage.from("chat-images").upload(fileName, file);

      if (error) {
        console.error("Upload error:", error);
        throw error;
      }

      const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(fileName);

      uploadedUrls.push(urlData.publicUrl);
    }

    return uploadedUrls;
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && selectedImages.length === 0) || isLoading) return;

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

    // Upload images if any
    let uploadedImageUrls: string[] = [];
    try {
      if (selectedImages.length > 0 && user) {
        uploadedImageUrls = await uploadImagesToStorage(selectedImages);
      }
    } catch (error) {
      console.error("Image upload failed:", error);
      toast({
        title: "Image upload failed",
        description: "Could not upload images. Try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue.trim() || "Uploaded image(s)",
      timestamp: new Date(),
      status: "sending",
      images: uploadedImageUrls,
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = inputValue.trim();
    setInputValue("");
    setSelectedImages([]);
    setImagePreviewUrls([]);
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
          stream: useStreaming, // ✨ STREAMING MODE toggle
          messages: conversationHistory,
          images: uploadedImageUrls,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle non-streaming mode
      if (!useStreaming) {
        const data = await response.json();
        
        // Turn off loading
        setIsLoading(false);
        setCurrentStatus(null);
        
        // Update bot message with complete response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                  ...msg,
                  content: data.answer || data.response_text || "No response",
                  query_log_id: data.query_log_id,
                  thumbnails: data.thumbnails,
                  manual_id: data.manual_id,
                  manual_title: data.manual_title,
                  rag_debug: data.rag_debug,
                }
              : msg,
          ),
        );
        
        // Mark user message as sent
        setMessages((prev) => prev.map((msg) => (msg.id === userMessage.id ? { ...msg, status: "sent" as const } : msg)));
        
        // Auto-save if logged in
        if (user && conversationIdToUse) {
          try {
            await supabase.from("conversation_messages").insert([
              { conversation_id: conversationIdToUse, role: "user", content: query },
              { conversation_id: conversationIdToUse, role: "assistant", content: data.answer || data.response_text }
            ]);
            await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationIdToUse);
            localStorage.setItem("last_conversation_id", conversationIdToUse);
          } catch (err) {
            console.error("Failed to auto-save messages:", err);
          }
        }
        
        return;
      }

      // Streaming response handling
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";
      let metadata: any = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              console.log("✅ Stream complete");
              continue;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              console.log("📦 Received chunk:", parsed);

              // Handle status updates
              if (parsed.type === "status" && parsed.data?.message) {
                setCurrentStatus(parsed.data.message);
              }

              // Handle content chunks (streaming answer)
              if (parsed.type === "content" && parsed.data) {
                // Turn off loading and clear status as soon as first content arrives
                setIsLoading(false);
                setCurrentStatus(null);

                // The data is always a string from the backend
                const visibleChunk = typeof parsed.data === "string" ? parsed.data : "";
                accumulatedContent += visibleChunk;

                // Update message with accumulated content
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? {
                          ...msg,
                          content: accumulatedContent,
                        }
                      : msg,
                  ),
                );
              }


              // Handle metadata (usage, manual detection, sources)
              if (parsed.type === "metadata" && parsed.data) {
                metadata = { ...metadata, ...parsed.data };

                // Handle usage info
                if (parsed.data.usage) {
                  onUsageUpdate?.(parsed.data.usage);
                }

                // Auto-set manual when detected
                if (parsed.data.auto_detected && parsed.data.manual_id && parsed.data.detected_manual_title) {
                  const detectedId = parsed.data.manual_id;
                  const detectedTitle = parsed.data.detected_manual_title;

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
              }

              // Handle metadata (legacy format)
              if (parsed.metadata) {
                metadata = { ...metadata, ...parsed.metadata };

                // Handle usage info
                if (parsed.metadata.usage) {
                  onUsageUpdate?.(parsed.metadata.usage);
                }

                // Auto-set manual when detected
                if (
                  parsed.metadata.auto_detected &&
                  parsed.metadata.manual_id &&
                  parsed.metadata.detected_manual_title
                ) {
                  const detectedId = parsed.metadata.manual_id;
                  const detectedTitle = parsed.metadata.detected_manual_title;

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
              }
            } catch (e) {
              console.error("Failed to parse SSE line:", e);
            }
          }
        }
      }

      // Final update with metadata (thumbnails, manual info)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                content: accumulatedContent,
                thumbnails: metadata.sources?.map((s: any) => s.thumbnail).filter(Boolean),
                manual_id: metadata.manual_id,
                manual_title: metadata.manual_title,
              }
            : msg,
        ),
      );

      console.log("✅ Stream processing complete");

      // Mark user message as sent
      setMessages((prev) => prev.map((msg) => (msg.id === userMessage.id ? { ...msg, status: "sent" as const } : msg)));

      // Auto-save message after completion for logged-in users
      if (user && conversationIdToUse) {
        try {
          // Use accumulated content for saving
          const contentToSave = accumulatedContent;

          await supabase.from("conversation_messages").insert([
            {
              conversation_id: conversationIdToUse,
              role: "user",
              content: query,
            },
            {
              conversation_id: conversationIdToUse,
              role: "assistant",
              content: contentToSave,
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
        actual_answer: message.content as string,
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

  const handleComponentInteraction = (componentId: string, type: string, value: any) => {
    const interaction: ComponentInteraction = {
      componentId,
      type,
      value,
      timestamp: new Date(),
    };

    setComponentInteractions((prev) => {
      const newMap = new Map(prev);
      newMap.set(componentId, value);
      return newMap;
    });

    // If it's a button click, you could trigger an automated response
    if (type === "button_click") {
      toast({
        title: "Action triggered",
        description: `${value.label} clicked`,
      });

      // Auto-send a message if configured
      if (value.autoSendMessage) {
        setInputValue(value.autoSendMessage);
        // Could automatically send it here if desired
      }
    }
  };

  const handleFormSubmit = (componentId: string, formData: Record<string, any>) => {
    const formattedMessage = Object.entries(formData)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    toast({
      title: "Form submitted",
      description: "Processing your input...",
    });

    // Auto-send the form data as a message
    setInputValue(`Form Response:\n${formattedMessage}`);
  };

  const renderInteractiveComponent = (component: InteractiveComponent, index: number) => {
    const componentId = component.id || `component-${index}`;

    switch (component.type) {
      case "progress":
        return (
          <div key={index} className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{component.data.label || "Progress"}</span>
              <span className="text-xs text-muted-foreground">{component.data.value || 0}%</span>
            </div>
            <Progress value={component.data.value || 0} className="h-2" />
            {component.data.description && (
              <p className="text-xs text-muted-foreground">{component.data.description}</p>
            )}
          </div>
        );

      case "status":
        return (
          <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
            {component.data.icon && (
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  component.data.status === "success"
                    ? "bg-green-500/20 text-green-500"
                    : component.data.status === "error"
                      ? "bg-red-500/20 text-red-500"
                      : component.data.status === "warning"
                        ? "bg-yellow-500/20 text-yellow-500"
                        : "bg-blue-500/20 text-blue-500"
                }`}
              >
                {component.data.icon}
              </div>
            )}
            <div className="flex-1">
              <div className="text-xs font-medium">{component.data.title}</div>
              {component.data.message && <div className="text-xs text-muted-foreground">{component.data.message}</div>}
            </div>
          </div>
        );

      case "button_group":
        return (
          <div key={index} className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border">
            {component.data.title && <div className="w-full text-xs font-medium mb-1">{component.data.title}</div>}
            {component.data.buttons?.map((btn: any, i: number) => (
              <Button
                key={i}
                variant={btn.variant || "outline"}
                size="sm"
                onClick={() =>
                  handleComponentInteraction(`${componentId}-btn-${i}`, "button_click", {
                    label: btn.label,
                    action: btn.action,
                    autoSendMessage: btn.autoSendMessage,
                  })
                }
                disabled={btn.disabled}
              >
                {btn.icon && <span className="mr-2">{btn.icon}</span>}
                {btn.label}
              </Button>
            ))}
          </div>
        );

      case "checklist":
        return (
          <div key={index} className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
            {component.data.title && <div className="text-xs font-medium">{component.data.title}</div>}
            <div className="space-y-2">
              {component.data.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    id={`${componentId}-${i}`}
                    checked={componentInteractions.get(`${componentId}-${i}`) || item.checked || false}
                    onCheckedChange={(checked) =>
                      handleComponentInteraction(`${componentId}-${i}`, "checkbox_change", checked)
                    }
                  />
                  <Label htmlFor={`${componentId}-${i}`} className="text-xs cursor-pointer">
                    {typeof item === "string" ? item : item.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case "form":
        return (
          <div key={index} className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
            {component.data.title && <div className="text-xs font-medium mb-2">{component.data.title}</div>}
            {component.data.fields?.map((field: any, i: number) => (
              <div key={i} className="space-y-1">
                {field.label && (
                  <Label htmlFor={`${componentId}-field-${i}`} className="text-xs">
                    {field.label}
                  </Label>
                )}
                {field.type === "input" && (
                  <Input
                    id={`${componentId}-field-${i}`}
                    type={field.inputType || "text"}
                    placeholder={field.placeholder}
                    value={componentInteractions.get(`${componentId}-field-${i}`) || ""}
                    onChange={(e) =>
                      handleComponentInteraction(`${componentId}-field-${i}`, "input_change", e.target.value)
                    }
                    className="text-xs"
                  />
                )}
                {field.type === "select" && (
                  <Select
                    value={componentInteractions.get(`${componentId}-field-${i}`) || field.defaultValue}
                    onValueChange={(value) =>
                      handleComponentInteraction(`${componentId}-field-${i}`, "select_change", value)
                    }
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder={field.placeholder || "Select..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt: any, optIdx: number) => (
                        <SelectItem key={optIdx} value={typeof opt === "string" ? opt : opt.value} className="text-xs">
                          {typeof opt === "string" ? opt : opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
            {component.data.submitButton && (
              <Button
                size="sm"
                onClick={() => {
                  const formData: Record<string, any> = {};
                  component.data.fields?.forEach((_field: any, i: number) => {
                    formData[`field-${i}`] = componentInteractions.get(`${componentId}-field-${i}`);
                  });
                  handleFormSubmit(componentId, formData);
                }}
                className="mt-2"
              >
                {component.data.submitButton.label || "Submit"}
              </Button>
            )}
          </div>
        );

      case "code":
        return (
          <div
            key={index}
            className="p-4 bg-black/50 rounded-lg border border-border font-mono text-xs overflow-x-auto"
          >
            <pre className="text-primary">{component.data.code}</pre>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStructuredAnswer = (answer: StructuredAnswer, messageId: string) => (
    <div className="space-y-3">
      {/* Summary */}
      <div className="text-xs leading-relaxed">{answer.summary}</div>

      {/* Interactive Components - DISABLED */}
      {/* {answer.interactive_components && answer.interactive_components.length > 0 && (
        <div className="space-y-3">
          {answer.interactive_components.map((component, index) => 
            renderInteractiveComponent(component, index)
          )}
        </div>
      )} */}

      {/* Steps as Checklist */}
      {answer.steps && answer.steps.length > 0 && (
        <div className="space-y-2">
          <div className="font-semibold text-[10px] text-primary uppercase tracking-wider">Procedure</div>
          {answer.steps.map((stepItem, i) => (
            <div key={i} className="flex gap-2 items-start">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-xs">{stepItem.step}</span>
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
                  <div className="text-[10px] text-muted-foreground">Expected: {stepItem.expected}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Why Explanation */}
      {answer.why && answer.why.length > 0 && (
        <div className="space-y-2">
          <div className="font-semibold text-[10px] text-primary uppercase tracking-wider">Why This Works</div>
          {answer.why.map((reason, i) => (
            <div key={i} className="text-xs text-muted-foreground pl-4 border-l-2 border-primary/20">
              {reason}
            </div>
          ))}
        </div>
      )}

      {/* Expert Advice / Pro Tips */}
      {answer.expert_advice && answer.expert_advice.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-[10px] text-primary uppercase tracking-wider">
            <Lightbulb className="h-4 w-4" />
            Pro Tips
          </div>
          {answer.expert_advice.map((tip, i) => (
            <div key={i} className="text-xs">
              • {tip}
            </div>
          ))}
        </div>
      )}

      {/* Safety Warnings */}
      {answer.safety && answer.safety.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-[10px] text-primary uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4" />
            Safety
          </div>
          {answer.safety.map((warning, i) => (
            <div key={i} className="text-xs">
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
              <InteractiveComponentLibrary />
              <Button
                variant="ghost"
                size="sm"
                onClick={startNewConversation}
                className="h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-white/5"
                title="Start new conversation"
              >
                <MessageSquarePlus className="h-4 w-4 mr-1.5" />
                <span className="text-xs">New</span>
              </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exportConversation}
                    disabled={messages.length <= 1}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-50"
                    title="Export conversation"
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                  
                  {/* Streaming toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUseStreaming(prev => {
                        const newValue = !prev;
                        localStorage.setItem('chatStreamingMode', JSON.stringify(newValue));
                        toast({
                          title: newValue ? "Streaming enabled" : "Streaming disabled",
                          description: newValue ? "Real-time token-by-token responses" : "Full response at once",
                        });
                        return newValue;
                      });
                    }}
                    className={`h-8 px-2 ${useStreaming ? 'text-green-500' : 'text-muted-foreground'} hover:text-foreground hover:bg-white/5`}
                    title={useStreaming ? "Streaming: Real-time token-by-token" : "Streaming disabled: Full response at once"}
                  >
                    {useStreaming ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                  </Button>
                  
                  {/* Debug mode toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDebugMode(prev => {
                        const newValue = !prev;
                        localStorage.setItem('chatDebugMode', JSON.stringify(newValue));
                        toast({
                          title: newValue ? "Debug mode enabled" : "Debug mode disabled",
                          description: newValue ? "Showing RAG debug panels" : "Debug panels hidden",
                        });
                        return newValue;
                      });
                    }}
                    className={`h-8 px-2 ${debugMode ? 'text-primary' : 'text-muted-foreground'} hover:text-foreground hover:bg-white/5`}
                    title={debugMode ? "Debug mode: ON" : "Debug mode: OFF"}
                  >
                    <span className="text-sm">🔧</span>
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
                      ? "bg-white/[0.08] border border-white/40 hover:bg-white/[0.10] shadow-[0_0_10px_rgba(255,255,255,0.15)]"
                      : "bg-white/[0.02] border-l-4 border-l-[hsl(24,100%,60%)]"
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
                    <>
                      <div className="text-xs whitespace-pre-wrap leading-relaxed">{message.content as string}</div>
                      {message.images && message.images.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.images.map((imageUrl, idx) => (
                            <img
                              key={idx}
                              src={imageUrl}
                              alt={`Uploaded ${idx + 1}`}
                              className="h-32 w-32 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setSelectedImage({ url: imageUrl, title: `Image ${idx + 1}` })}
                            />
                          ))}
                        </div>
                      )}
                    </>
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
                            <span className="text-xs opacity-70">{currentStatus || "Typing..."}</span>
                          </div>
                        )}
                      </div>
                      {isStructuredAnswer(message.content) ? (
                        renderStructuredAnswer(message.content, message.id)
                      ) : (
                        <div className="text-xs whitespace-pre-wrap leading-relaxed">
                          {typeof message.content === "string" ? message.content : JSON.stringify(message.content)}
                        </div>
                      )}

                      {/* Render interactive components - DISABLED */}
                      {/* {message.interactiveComponents && message.interactiveComponents.length > 0 && (
                        <div className="space-y-2">
                          {message.interactiveComponents.map((component) => (
                            <InteractiveComponentRenderer
                              key={component.id}
                              component={component}
                              onAutoSend={(text) => {
                                setInputValue(text);
                                setTimeout(() => handleSendMessage(), 100);
                              }}
                            />
                          ))}
                        </div>
                      )} */}
                    </>
                  )}

                  {/* Manual Source Info */}
                  {message.type === "bot" && message.manual_id && (
                    <div className="mt-4 pt-4 border-t border-primary/10">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Source: {message.manual_title || message.manual_id}</span>
                      </div>
                    </div>
                  )}

                  {/* Display thumbnails/images */}
                  {message.type === "bot" && message.thumbnails && message.thumbnails.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-primary/10">
                      <div className="text-xs font-semibold text-primary mb-3">Reference Images</div>
                      <div className="grid grid-cols-2 gap-4">
                        {message.thumbnails.map((thumb, idx) => (
                          <div
                            key={idx}
                            className="tech-card bg-background/50 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                            onClick={() => setSelectedImage({ url: thumb.url, title: thumb.title })}
                          >
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

                  {/* RAG Debug Panel */}
                  {message.type === "bot" && message.rag_debug && debugMode && (
                    <RAGDebugPanel ragData={message.rag_debug} className="mt-6" />
                  )}

                  {/* Thumbs Up/Down + Report Issue for Bot Messages */}
                  {message.type === "bot" && (
                    <div className="mt-4 pt-4 border-t border-primary/10 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground mr-2">Was this helpful?</span>
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

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border py-5 px-6 flex-shrink-0 w-full">
            <>
              {/* Image Previews */}
              {imagePreviewUrls.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {imagePreviewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Upload ${index + 1}`}
                        className="h-20 w-20 object-cover rounded-lg border border-border"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex space-x-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="ghost"
                  size="lg"
                  className="h-12 px-4"
                  title="Upload images"
                  disabled={isLoading || !selectedManualId || selectedImages.length >= 4}
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
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
                  disabled={(!inputValue.trim() && selectedImages.length === 0) || isLoading || !selectedManualId}
                  size="lg"
                  variant="orange"
                  className="h-12 px-6"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
              <div className="text-sm text-muted-foreground mt-3 flex items-center justify-between">
                <span>Press Enter to send • Shift+Enter for new line • 📎 Upload images</span>
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

        {/* Image Enlargement Dialog */}
        <Dialog open={selectedImage !== null} onOpenChange={(open) => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-5xl w-[95vw] bg-background/95 backdrop-blur-sm border-primary/20 shadow-2xl">
            <DialogHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="text-foreground font-tech text-lg">
                  {selectedImage?.title || "Image"}
                </DialogTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedImage?.url) {
                        const link = document.createElement("a");
                        link.href = selectedImage.url;
                        link.download = `${selectedImage.title || "image"}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast({
                          title: "Download started",
                          description: "Image is being downloaded",
                        });
                      }
                    }}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedImage(null)} className="gap-2">
                    <XCircle className="h-4 w-4" />
                    Close
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Click outside or press ESC to close</p>
            </DialogHeader>
            <div className="rounded-lg border border-border/50 bg-muted/20 p-6 flex items-center justify-center min-h-[400px]">
              <img
                src={selectedImage?.url}
                alt={selectedImage?.title}
                className="max-w-full max-h-[70vh] object-contain rounded-md shadow-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
