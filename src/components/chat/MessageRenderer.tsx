import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StructuredAnswerRenderer } from "./StructuredAnswerRenderer";
import { InteractiveComponentRenderer } from "@/components/InteractiveComponentRenderer";
import { RAGDebugPanel } from "@/components/RAGDebugPanel";
import { Bot, User, ThumbsUp, ThumbsDown, Eye, Clock, CheckCircle2, Loader2 } from "lucide-react";

interface ChatMessage {
  id: string;
  type: "user" | "bot";
  content: string | any;
  timestamp: Date;
  query_log_id?: string;
  feedback?: "thumbs_up" | "thumbs_down" | null;
  status?: "sending" | "sent" | "failed";
  thumbnails?: Array<{ page_id: string; url: string; title: string }>;
  manual_id?: string;
  manual_title?: string;
  images?: string[];
  image_analysis?: any;
  interactiveComponents?: any[];
  rag_debug?: any;
}

interface MessageRendererProps {
  message: ChatMessage;
  currentStatus?: string | null;
  onFeedback?: (messageId: string, feedbackType: "thumbs_up" | "thumbs_down") => void;
  onThumbnailClick?: (thumbnail: any) => void;
  onAutoSend?: (text: string) => void;
  onReportIssue?: (message: ChatMessage) => void;
  debugMode?: boolean;
  useLegacySearch?: boolean;
  onToggleLegacy?: (enabled: boolean) => void;
}

export function MessageRenderer({
  message,
  currentStatus,
  onFeedback,
  onThumbnailClick,
  onAutoSend,
  onReportIssue,
  debugMode = false,
  useLegacySearch = false,
  onToggleLegacy,
}: MessageRendererProps) {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const isStructuredAnswer = (content: any): content is object => {
    return typeof content === "object" && content !== null && "summary" in content;
  };

  return (
    <div className={`flex gap-3 ${message.type === "user" ? "justify-end" : "justify-start"} mb-6`}>
      {message.type === "bot" && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange to-orange-light flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}

      <div className={`flex-1 max-w-[85%] ${message.type === "user" ? "flex flex-col items-end" : ""}`}>
        {/* Loading status for bot messages */}
        {message.type === "bot" && (!message.content || String(message.content).trim() === '') && currentStatus && (
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{currentStatus}</span>
          </div>
        )}

        <div
          className={`rounded-lg p-4 ${
            message.type === "user"
              ? "bg-white/5 border border-white/10"
              : "bg-white/5 border border-white/10"
          }`}
        >
          {/* Message Content */}
          {isStructuredAnswer(message.content) ? (
            <StructuredAnswerRenderer content={message.content as any} />
          ) : (
            <div className="text-sm text-foreground/90 whitespace-pre-wrap">
              {String(message.content) || (message.type === "bot" ? "..." : "")}
            </div>
          )}

          {/* User Images */}
          {message.type === "user" && message.images && message.images.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {message.images.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Uploaded ${idx + 1}`}
                  onClick={() => setEnlargedImage(url)}
                  className="w-20 h-20 object-cover rounded border border-white/20 cursor-pointer hover:opacity-80 transition-opacity"
                />
              ))}
            </div>
          )}

          {/* Image Analysis */}
          {message.image_analysis && (
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
              <div className="font-semibold text-blue-400 mb-1">Image Analysis:</div>
              <div className="text-foreground/80">{message.image_analysis.description}</div>
              {message.image_analysis.detected_issues?.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold text-blue-400 mb-1">Detected Issues:</div>
                  <ul className="list-disc list-inside text-foreground/80">
                    {message.image_analysis.detected_issues.map((issue: string, idx: number) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Interactive Components */}
          {message.interactiveComponents && message.interactiveComponents.length > 0 && (
            <div className="mt-4 space-y-3">
              {message.interactiveComponents.map((component) => (
                <InteractiveComponentRenderer
                  key={component.id}
                  component={component}
                  onAutoSend={onAutoSend || (() => {})}
                />
              ))}
            </div>
          )}

          {/* Thumbnails */}
          {message.thumbnails && message.thumbnails.length > 0 && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Referenced Images:
              </div>
              <div className="flex flex-wrap gap-2">
                {message.thumbnails.map((thumb, idx) => (
                  <button
                    key={idx}
                    onClick={() => onThumbnailClick?.(thumb)}
                    className="group relative"
                  >
                    <img
                      src={thumb.url}
                      alt={thumb.title}
                      className="w-16 h-16 object-cover rounded border border-white/20 group-hover:border-orange/50 transition-colors"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                      <Eye className="h-4 w-4 text-white" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Message Metadata */}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          
          {message.status === "sending" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Sending...</span>
            </>
          )}
          {message.status === "sent" && (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          )}

          {message.manual_title && (
            <Badge variant="outline" className="text-[10px]">
              {message.manual_title}
            </Badge>
          )}
        </div>

        {/* Feedback Buttons */}
        {message.type === "bot" && message.query_log_id && (
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFeedback?.(message.id, "thumbs_up")}
              className={`h-7 px-2 ${
                message.feedback === "thumbs_up" ? "text-green-500" : "text-muted-foreground"
              } hover:text-green-500`}
            >
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFeedback?.(message.id, "thumbs_down")}
              className={`h-7 px-2 ${
                message.feedback === "thumbs_down" ? "text-red-500" : "text-muted-foreground"
              } hover:text-red-500`}
            >
              <ThumbsDown className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* RAG Debug Panel */}
        {debugMode && message.rag_debug && (
          <div className="mt-3">
            <RAGDebugPanel 
              ragData={message.rag_debug}
              useLegacySearch={useLegacySearch}
              onToggleLegacy={onToggleLegacy}
            />
          </div>
        )}

        {/* Report Issue Button */}
        {message.type === "bot" && onReportIssue && (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReportIssue(message)}
              className="h-7 px-2 text-xs"
            >
              Report Issue
            </Button>
          </div>
        )}
      </div>

      {message.type === "user" && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
          <User className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Enlarged Image Dialog */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-4xl">
          {enlargedImage && (
            <img src={enlargedImage} alt="Enlarged view" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
