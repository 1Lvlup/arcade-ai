import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { InteractiveComponentLibrary } from "@/components/InteractiveComponentLibrary";
import {
  MessageSquarePlus,
  Save,
  FileDown,
  History,
  Zap,
  ZapOff,
  Settings,
} from "lucide-react";

interface ChatHeaderProps {
  manualTitle: string | null;
  user: any;
  guestMessageCount: number;
  guestLimit: number;
  useStreaming: boolean;
  debugMode: boolean;
  structuredMode: boolean;
  onNewConversation: () => void;
  onSave: () => void;
  onExport: () => void;
  onToggleStreaming: () => void;
  onToggleDebug: () => void;
  onToggleStructured: () => void;
  isSaving: boolean;
  canSave: boolean;
  canExport: boolean;
  showHistory: boolean;
  onToggleHistory: () => void;
  historyContent?: React.ReactNode;
  isAdmin?: boolean;
}

export function ChatHeader({
  manualTitle,
  user,
  guestMessageCount,
  guestLimit,
  useStreaming,
  debugMode,
  structuredMode,
  onNewConversation,
  onSave,
  onExport,
  onToggleStreaming,
  onToggleDebug,
  onToggleStructured,
  isSaving,
  canSave,
  canExport,
  showHistory,
  onToggleHistory,
  historyContent,
  isAdmin = false,
}: ChatHeaderProps) {
  return (
    <div className="border-b border-white/10 flex-shrink-0 py-3 px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="tracking-wider font-bold text-white font-tech">LEVEL UP</span>
          {manualTitle && (
            <Badge className="bg-orange/20 text-orange border-orange/30 text-xs">{manualTitle}</Badge>
          )}
          {!user && (
            <Badge variant="outline" className="text-xs border-white/20 text-muted-foreground">
              {guestLimit - guestMessageCount} free questions left
            </Badge>
          )}
          {structuredMode && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
              Structured Mode
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <InteractiveComponentLibrary />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewConversation}
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
                onClick={onSave}
                disabled={!canSave || isSaving}
                className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-50"
                title="Save conversation"
              >
                <Save className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                disabled={!canExport}
                className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-50"
                title="Export conversation"
              >
                <FileDown className="h-4 w-4" />
              </Button>

              {/* Admin-only toggles */}
              {isAdmin && (
                <>
                  {/* Streaming toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleStreaming}
                    className={`h-8 px-2 ${useStreaming ? 'text-green-500' : 'text-muted-foreground'} hover:text-foreground hover:bg-white/5`}
                    title={useStreaming ? "Streaming: Real-time token-by-token" : "Streaming disabled: Full response at once"}
                  >
                    {useStreaming ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                  </Button>

                  {/* Debug mode toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleDebug}
                    className={`h-8 px-2 ${debugMode ? 'text-primary' : 'text-muted-foreground'} hover:text-foreground hover:bg-white/5`}
                    title={debugMode ? "Debug mode: ON" : "Debug mode: OFF"}
                  >
                    <span className="text-sm">🔧</span>
                  </Button>
                </>
              )}

              {/* Structured mode toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleStructured}
                className={`h-8 px-2 ${structuredMode ? 'text-blue-500' : 'text-muted-foreground'} hover:text-foreground hover:bg-white/5`}
                title={structuredMode ? "Structured troubleshooting: ON" : "Structured troubleshooting: OFF"}
              >
                <Settings className="h-4 w-4" />
              </Button>

              <Sheet open={showHistory} onOpenChange={onToggleHistory}>
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
                    <SheetTitle className="font-tech text-white">
                      {structuredMode ? "SESSION HISTORY" : "CONVERSATION HISTORY"}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    {historyContent}
                  </div>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
