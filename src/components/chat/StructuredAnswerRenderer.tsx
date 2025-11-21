import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Lightbulb, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

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
  interactive_components?: any[];
}

interface TroubleshootingResponse {
  summary: string;
  next_actions: string[];
  questions_for_tech: string[];
  status: "continue" | "probably_fixed" | "escalate" | "need_manual" | "done";
  escalation?: {
    reason: string;
    recommended_target: string;
    info_to_pass_on: string;
  };
}

interface StructuredAnswerRendererProps {
  content: StructuredAnswer | TroubleshootingResponse;
  onSourceClick?: (page: number) => void;
}

export function StructuredAnswerRenderer({ content, onSourceClick }: StructuredAnswerRendererProps) {
  const [showSources, setShowSources] = useState(false);

  // Check if this is a TroubleshootingResponse
  const isTroubleshooting = 'next_actions' in content;

  if (isTroubleshooting) {
    const troubleshootingContent = content as TroubleshootingResponse;
    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="text-sm text-foreground/90">
          {troubleshootingContent.summary}
        </div>

        {/* Next Actions */}
        {troubleshootingContent.next_actions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-orange font-semibold uppercase tracking-wide">
              <CheckCircle2 className="h-4 w-4" />
              Next Actions
            </div>
            {troubleshootingContent.next_actions.map((action, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm pl-2">
                <span className="text-orange font-medium flex-shrink-0">{idx + 1}.</span>
                <span className="text-foreground/90">{action}</span>
              </div>
            ))}
          </div>
        )}

        {/* Questions for Tech */}
        {troubleshootingContent.questions_for_tech && troubleshootingContent.questions_for_tech.length > 0 && (
          <div className="space-y-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="text-xs text-blue-400 font-semibold uppercase tracking-wide">
              Questions
            </div>
            {troubleshootingContent.questions_for_tech.map((question, idx) => (
              <div key={idx} className="text-sm text-foreground/90">
                • {question}
              </div>
            ))}
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={
              troubleshootingContent.status === 'done' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
              troubleshootingContent.status === 'escalate' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
              troubleshootingContent.status === 'probably_fixed' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
              'bg-blue-500/10 text-blue-500 border-blue-500/20'
            }
          >
            {troubleshootingContent.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>
    );
  }

  // Standard StructuredAnswer rendering
  const structuredContent = content as StructuredAnswer;
  
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-sm text-foreground/90">
        {structuredContent.summary}
      </div>

      {/* Steps */}
      {structuredContent.steps && structuredContent.steps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-orange font-semibold uppercase tracking-wide">
            <CheckCircle2 className="h-4 w-4" />
            Steps
          </div>
          {structuredContent.steps.map((step, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-start gap-3 text-sm">
                <span className="text-orange font-medium flex-shrink-0">{idx + 1}.</span>
                <div className="flex-1">
                  <span className="text-foreground/90">{step.step}</span>
                  {step.source && (
                    <Badge
                      variant="outline"
                      className={
                        step.source === "manual"
                          ? "ml-2 text-[10px] bg-green-500/10 text-green-500 border-green-500/20"
                          : "ml-2 text-[10px] bg-orange/10 text-orange border-orange/20"
                      }
                    >
                      {step.source}
                    </Badge>
                  )}
                  {step.expected && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Expected: {step.expected}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Why Section */}
      {structuredContent.why && structuredContent.why.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
            Why This Works
          </div>
          {structuredContent.why.map((item, idx) => (
            <div key={idx} className="text-sm text-muted-foreground pl-4 border-l-2 border-orange/20">
              {item}
            </div>
          ))}
        </div>
      )}

      {/* Expert Advice / Tips */}
      {structuredContent.expert_advice && structuredContent.expert_advice.length > 0 && (
        <div className="bg-orange/5 border border-orange/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-orange font-semibold uppercase tracking-wide">
            <Lightbulb className="h-4 w-4" />
            Pro Tips
          </div>
          {structuredContent.expert_advice.map((tip, idx) => (
            <div key={idx} className="text-sm text-foreground/80">
              • {tip}
            </div>
          ))}
        </div>
      )}

      {/* Safety Warnings */}
      {structuredContent.safety && structuredContent.safety.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-red-400 font-semibold uppercase tracking-wide">
            <AlertTriangle className="h-4 w-4" />
            Safety Warning
          </div>
          {structuredContent.safety.map((warning, idx) => (
            <div key={idx} className="text-sm text-red-300">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      {/* Sources */}
      {structuredContent.sources && structuredContent.sources.length > 0 && (
        <div className="border-t border-white/10 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSources(!showSources)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showSources ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {structuredContent.sources.length} source{structuredContent.sources.length > 1 ? 's' : ''}
          </Button>
          {showSources && (
            <div className="space-y-2 mt-2">
              {structuredContent.sources.map((source, idx) => (
                <div
                  key={idx}
                  onClick={() => onSourceClick?.(source.page)}
                  className="text-xs p-2 bg-white/5 rounded border border-white/10 hover:border-orange/50 cursor-pointer transition-colors"
                >
                  <Badge variant="outline" className="text-[10px] mr-2">
                    Page {source.page}
                  </Badge>
                  <span className="text-muted-foreground">{source.note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
