import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type InteractiveComponent = {
  type: "button_group" | "checklist" | "code" | "form" | "input" | "select" | "progress" | "status" | "button" | "image" | "slider" | "wizard";
  id: string;
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
        <div className="space-y-2">
          {component.data.items?.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2">
              <Checkbox
                id={`${component.id}-${idx}`}
                defaultChecked={item.checked}
              />
              <Label
                htmlFor={`${component.id}-${idx}`}
                className="text-sm cursor-pointer"
              >
                {item.label}
              </Label>
            </div>
          ))}
        </div>
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
              <Label htmlFor={`${component.id}-${field.id}`} className="text-sm">
                {field.label}
              </Label>
              {field.type === "input" && (
                <Input
                  id={`${component.id}-${field.id}`}
                  placeholder={field.placeholder}
                  className="bg-background"
                />
              )}
              {field.type === "select" && (
                <Select>
                  <SelectTrigger className="bg-background">
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
        <pre className="text-xs overflow-x-auto">
          <code>{component.data.code || component.data.content}</code>
        </pre>
      </Card>
    );
  }

  // Fallback for unsupported types
  return null;
}
