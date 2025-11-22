import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Settings2, Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';

interface SmartOptimizeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  relevanceThreshold?: number;
  onThresholdChange?: (threshold: number) => void;
  maxChunks?: number;
  onMaxChunksChange?: (max: number) => void;
}

export function SmartOptimizeToggle({
  enabled,
  onToggle,
  relevanceThreshold = 5,
  onThresholdChange,
  maxChunks = 20,
  onMaxChunksChange,
}: SmartOptimizeToggleProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Label htmlFor="smart-optimize" className="font-medium">
              Smart Optimize
            </Label>
            {enabled && (
              <Badge variant="default" className="text-xs">
                Active
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Popover open={showSettings} onOpenChange={setShowSettings}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Relevance Threshold</Label>
                      <span className="text-sm text-muted-foreground">{relevanceThreshold}</span>
                    </div>
                    <Slider
                      value={[relevanceThreshold]}
                      onValueChange={(value) => onThresholdChange?.(value[0])}
                      min={1}
                      max={20}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Higher values select fewer, more relevant chunks
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Max Chunks</Label>
                      <span className="text-sm text-muted-foreground">{maxChunks}</span>
                    </div>
                    <Slider
                      value={[maxChunks]}
                      onValueChange={(value) => onMaxChunksChange?.(value[0])}
                      min={5}
                      max={50}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of chunks to include
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Switch
              id="smart-optimize"
              checked={enabled}
              onCheckedChange={onToggle}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p>
            {enabled 
              ? 'AI will automatically select relevant code chunks based on your query'
              : 'Manually select specific chunks from the "Chunks" tab'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
