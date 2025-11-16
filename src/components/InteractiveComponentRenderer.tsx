import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type InteractiveComponentType =
  | "button_group"
  | "checklist"
  | "form"
  | "code"
  | "progress"
  | "status";

type InteractiveComponent = {
  id: string;
  type: InteractiveComponentType;
  data: any;
};

interface InteractiveComponentRendererProps {
  component: InteractiveComponent;
  onAutoSend: (text: string) => void;
}

export function InteractiveComponentRenderer({ component, onAutoSend }: InteractiveComponentRendererProps) {
  if (component.type === "button_group") {
    return (
      <Card className="p-4 bg-muted/30 border-border/50 mt-3">
        <div className="font-semibold mb-3 text-foreground">{component.data.title}</div>
        <div className="flex flex-wrap gap-2">
          {component.data.buttons?.map((btn: any, idx: number) => (
            <Button
              key={idx}
              variant={btn.variant === "outline" ? "outline" : "default"}
              size="sm"
              onClick={() => {
                if (btn.autoSendMessage) {
                  onAutoSend(btn.autoSendMessage);
                }
              }}
              className="text-sm"
            >
              {btn.label}
            </Button>
          ))}
        </div>
      </Card>
    );
  }

  if (component.type === "checklist") {
    return (
      <Card className="p-4 bg-muted/30 border-border/50 mt-3">
        <div className="font-semibold mb-3 text-foreground">{component.data.title}</div>
        <ul className="text-sm space-y-1">
          {component.data.items?.map((item: string, idx: number) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (component.type === "form") {
    return (
      <Card className="p-4 bg-muted/30 border-border/50 mt-3">
        <div className="font-semibold mb-3 text-foreground">{component.data.title}</div>
        <div className="space-y-3">
          {component.data.fields?.map((field: any, idx: number) => (
            <div key={idx} className="space-y-1">
              <Label htmlFor={`${component.id}-${field.id || idx}`} className="text-sm font-medium">
                {field.label}
              </Label>
              {field.type === "input" && (
                <Input
                  id={`${component.id}-${field.id || idx}`}
                  placeholder={field.placeholder || ""}
                  className="bg-background text-sm"
                />
              )}
              {field.type === "select" && (
                <Select>
                  <SelectTrigger className="bg-background text-sm">
                    <SelectValue placeholder={field.placeholder || "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt: string, optIdx: number) => (
                      <SelectItem key={optIdx} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (component.type === "code") {
    return (
      <Card className="p-4 bg-muted/30 border-border/50 mt-3 font-mono">
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
          <code>{component.data.code || component.data.content}</code>
        </pre>
      </Card>
    );
  }

  if (component.type === "progress") {
    return (
      <Card className="p-4 bg-muted/30 border-border/50 mt-3">
        <div className="font-semibold mb-2 text-foreground text-sm">
          {component.data.title}
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${component.data.percent ?? 0}%` }}
          />
        </div>
        {component.data.percent !== undefined && (
          <div className="text-xs text-muted-foreground mt-1 text-right">
            {component.data.percent}%
          </div>
        )}
      </Card>
    );
  }

  if (component.type === "status") {
    return (
      <Card className="p-4 bg-muted/30 border-border/50 mt-3">
        <div className="font-semibold mb-3 text-foreground text-sm">
          {component.data.title}
        </div>
        <ul className="text-sm space-y-2">
          {component.data.items?.map((item: any, idx: number) => (
            <li key={idx} className="flex flex-col gap-1">
              <span className="font-semibold text-primary">{item.label}:</span>
              <span className="text-muted-foreground">{item.description}</span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  // Fallback for unsupported types
  return null;
}
