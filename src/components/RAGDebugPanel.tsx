import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";

interface RAGDebugData {
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
}

interface RAGDebugPanelProps {
  ragData: RAGDebugData;
  className?: string;
  useLegacySearch?: boolean; // NEW
  onToggleLegacy?: (enabled: boolean) => void; // NEW
}

export function RAGDebugPanel({ ragData, className = "", useLegacySearch = false, onToggleLegacy }: RAGDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  // Defensive check for chunks array
  const chunks = ragData?.chunks || [];
  const chunkCount = chunks.length;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(ragData, null, 2));
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "RAG debug data copied successfully",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const getQualityColor = (score: number) => {
    if (score >= 0.7) return "text-green-500";
    if (score >= 0.5) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500/20 text-green-400";
    if (score >= 0.6) return "bg-yellow-500/20 text-yellow-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="border border-border/50 rounded-lg bg-muted/30 overflow-hidden">
        {/* A/B Testing Toggle (if handler provided) */}
        {onToggleLegacy && (
          <div className="p-4 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="legacy-toggle" className="text-xs font-semibold">
                  🔄 A/B Test Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use legacy search-manuals-robust pipeline for comparison
                </p>
              </div>
              <Switch
                id="legacy-toggle"
                checked={useLegacySearch}
                onCheckedChange={onToggleLegacy}
              />
            </div>
          </div>
        )}
        
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">🔧 RAG Debug Info</span>
              <Badge variant="outline" className="text-xs">
                {chunkCount} chunks
              </Badge>
              <Badge 
                variant="outline" 
                className={`text-xs ${ragData?.answer_style?.is_weak ? 'border-yellow-500/50 text-yellow-500' : 'border-green-500/50 text-green-500'}`}
              >
                {ragData?.answer_style?.adaptive_mode || 'standard'}
              </Badge>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4 border-t border-border/50">
            {/* Overview Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overview</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Strategy</p>
                  <Badge variant="secondary" className="text-xs">
                    {ragData.strategy || 'hybrid'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Quality Score</p>
                  <p className={`text-sm font-semibold ${getQualityColor(ragData.quality_score)}`}>
                    {(ragData.quality_score * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Answer Style Signals */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Signals</h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Top Score</span>
                    <span className="font-medium">{ragData.signals.topScore.toFixed(3)}</span>
                  </div>
                  <Progress value={ragData.signals.topScore * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Avg Top 3</span>
                    <span className="font-medium">{ragData.signals.avgTop3.toFixed(3)}</span>
                  </div>
                  <Progress value={ragData.signals.avgTop3 * 100} className="h-2" />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Strong Hits</span>
                  <Badge variant="secondary">{ragData.signals.strongHits}</Badge>
                </div>
              </div>
            </div>

            {/* Retrieved Chunks */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Retrieved Chunks (Top {Math.min(5, chunkCount)})
              </h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {chunks.slice(0, 5).map((chunk, idx) => (
                  <div key={idx} className="border border-border/50 rounded-md p-3 bg-background/50 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                        <span className="text-xs text-muted-foreground">
                          p{chunk.page_start}{chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={`text-xs ${getScoreColor(chunk.score)}`}>
                          Vec: {chunk.score.toFixed(3)}
                        </Badge>
                        <Badge className={`text-xs ${getScoreColor(chunk.rerank_score)}`}>
                          Rerank: {chunk.rerank_score.toFixed(3)}
                        </Badge>
                      </div>
                    </div>
                    {chunk.menu_path && (
                      <p className="text-xs text-muted-foreground/70 font-mono">
                        {chunk.menu_path}
                      </p>
                    )}
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {chunk.content_preview}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Performance</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Search</p>
                  <p className="text-sm font-semibold">{ragData.performance.search_ms}ms</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Generation</p>
                  <p className="text-sm font-semibold">{ragData.performance.generation_ms}ms</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-semibold">{ragData.performance.total_ms}ms</p>
                </div>
              </div>
            </div>

            {/* Copy Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="w-full"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Full Debug Data
                </>
              )}
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
