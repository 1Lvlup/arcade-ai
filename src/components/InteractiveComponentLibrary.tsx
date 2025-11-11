import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Code2,
  Eye,
  Zap,
  FileCode,
  Sparkles,
} from "lucide-react";

interface ComponentExample {
  id: string;
  name: string;
  description: string;
  category: "input" | "feedback" | "action" | "display";
  preview: React.ReactNode;
  code: string;
  useCase: string;
}

export function InteractiveComponentLibrary() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [demoProgress, setDemoProgress] = useState(65);
  const [demoSlider, setDemoSlider] = useState([50]);
  const [demoInput, setDemoInput] = useState("");
  const [demoSelect, setDemoSelect] = useState("");
  const [demoChecklist, setDemoChecklist] = useState<Record<string, boolean>>({
    item1: true,
    item2: false,
    item3: false,
  });

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast({
      title: "Copied to clipboard",
      description: "Backend integration code copied successfully",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const componentExamples: ComponentExample[] = [
    {
      id: "progress",
      name: "Progress Bar",
      description: "Display task completion or loading status",
      category: "feedback",
      preview: (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Processing Manual Upload</span>
            <span className="text-xs text-muted-foreground">{demoProgress}%</span>
          </div>
          <Progress value={demoProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">OCR extraction in progress...</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDemoProgress((prev) => Math.min(100, prev + 10))}
          >
            Advance Progress
          </Button>
        </div>
      ),
      code: `{
  "type": "progress",
  "id": "upload-progress",
  "data": {
    "label": "Processing Manual Upload",
    "value": 65,
    "description": "OCR extraction in progress..."
  }
}`,
      useCase: "Show real-time progress for long-running tasks like document processing, data imports, or multi-step troubleshooting procedures.",
    },
    {
      id: "status",
      name: "Status Indicator",
      description: "Display success, error, warning, or info messages",
      category: "feedback",
      preview: (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-green-500/20 text-green-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium">Connection Verified</div>
              <div className="text-xs text-muted-foreground">All systems operational</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-yellow-500/20 text-yellow-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium">Low Voltage Detected</div>
              <div className="text-xs text-muted-foreground">Check power supply connections</div>
            </div>
          </div>
        </div>
      ),
      code: `{
  "type": "status",
  "id": "diagnostic-status",
  "data": {
    "icon": "✓",
    "status": "success",
    "title": "Connection Verified",
    "message": "All systems operational"
  }
}`,
      useCase: "Provide instant feedback on diagnostic checks, system health, or troubleshooting step outcomes.",
    },
    {
      id: "button",
      name: "Action Button",
      description: "Trigger actions or auto-fill user responses",
      category: "action",
      preview: (
        <div className="space-y-2">
          <Button variant="default" size="sm">
            <Zap className="mr-2 h-4 w-4" />
            Run Diagnostic Test
          </Button>
          <Button variant="outline" size="sm">
            Skip This Step
          </Button>
          <Button variant="secondary" size="sm">
            View Manual Page 42
          </Button>
        </div>
      ),
      code: `{
  "type": "button",
  "id": "diagnostic-btn",
  "data": {
    "label": "Run Diagnostic Test",
    "icon": "⚡",
    "variant": "default",
    "size": "sm",
    "action": "run_diagnostic",
    "autoSendMessage": "Please run the power supply diagnostic test"
  }
}`,
      useCase: "Enable users to quickly select common responses, trigger automated workflows, or navigate to specific manual sections.",
    },
    {
      id: "button_group",
      name: "Button Group",
      description: "Multiple choice actions",
      category: "action",
      preview: (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border">
          <div className="w-full text-xs font-medium mb-1">What symptoms are you seeing?</div>
          <Button variant="outline" size="sm">
            No Power
          </Button>
          <Button variant="outline" size="sm">
            Intermittent
          </Button>
          <Button variant="outline" size="sm">
            Error Codes
          </Button>
          <Button variant="outline" size="sm">
            Strange Sounds
          </Button>
        </div>
      ),
      code: `{
  "type": "button_group",
  "id": "symptom-selector",
  "data": {
    "title": "What symptoms are you seeing?",
    "buttons": [
      {
        "label": "No Power",
        "variant": "outline",
        "autoSendMessage": "The machine has no power"
      },
      {
        "label": "Intermittent",
        "variant": "outline",
        "autoSendMessage": "The issue happens intermittently"
      },
      {
        "label": "Error Codes",
        "variant": "outline",
        "autoSendMessage": "I'm seeing error codes on the display"
      }
    ]
  }
}`,
      useCase: "Present multiple symptom choices, decision paths, or quick action options for faster troubleshooting.",
    },
    {
      id: "input",
      name: "Text Input",
      description: "Collect text responses from users",
      category: "input",
      preview: (
        <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
          <Label htmlFor="demo-input" className="text-xs font-medium">
            Error Code Number
          </Label>
          <Input
            id="demo-input"
            type="text"
            placeholder="e.g., E42-7"
            value={demoInput}
            onChange={(e) => setDemoInput(e.target.value)}
            className="text-xs"
            maxLength={20}
          />
          <p className="text-xs text-muted-foreground">Enter the exact code shown on the display</p>
        </div>
      ),
      code: `{
  "type": "input",
  "id": "error-code-input",
  "data": {
    "label": "Error Code Number",
    "placeholder": "e.g., E42-7",
    "description": "Enter the exact code shown on the display",
    "inputType": "text",
    "maxLength": 20
  }
}`,
      useCase: "Gather specific information like error codes, part numbers, voltage readings, or other diagnostic data.",
    },
    {
      id: "select",
      name: "Dropdown Select",
      description: "Choose from predefined options",
      category: "input",
      preview: (
        <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
          <Label htmlFor="demo-select" className="text-xs font-medium">
            Game Cabinet Model
          </Label>
          <Select value={demoSelect} onValueChange={setDemoSelect}>
            <SelectTrigger id="demo-select" className="text-xs">
              <SelectValue placeholder="Select your model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classic" className="text-xs">
                Classic Upright
              </SelectItem>
              <SelectItem value="cocktail" className="text-xs">
                Cocktail Table
              </SelectItem>
              <SelectItem value="mini" className="text-xs">
                Mini Cabinet
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Select the cabinet type for accurate diagnostics</p>
        </div>
      ),
      code: `{
  "type": "select",
  "id": "cabinet-model",
  "data": {
    "label": "Game Cabinet Model",
    "placeholder": "Select your model",
    "description": "Select the cabinet type for accurate diagnostics",
    "options": [
      { "value": "classic", "label": "Classic Upright" },
      { "value": "cocktail", "label": "Cocktail Table" },
      { "value": "mini", "label": "Mini Cabinet" }
    ]
  }
}`,
      useCase: "Help users specify their exact hardware model, configuration, or choose from known issue categories.",
    },
    {
      id: "slider",
      name: "Slider Control",
      description: "Adjust numeric values or ratings",
      category: "input",
      preview: (
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <Label htmlFor="demo-slider" className="text-xs font-medium">
              Issue Severity Level
            </Label>
            <span className="text-xs text-muted-foreground">{demoSlider[0]}/100</span>
          </div>
          <Slider
            id="demo-slider"
            min={0}
            max={100}
            step={10}
            value={demoSlider}
            onValueChange={setDemoSlider}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">Rate from 0 (minor) to 100 (critical)</p>
        </div>
      ),
      code: `{
  "type": "slider",
  "id": "severity-rating",
  "data": {
    "label": "Issue Severity Level",
    "min": 0,
    "max": 100,
    "step": 10,
    "defaultValue": 50,
    "description": "Rate from 0 (minor) to 100 (critical)"
  }
}`,
      useCase: "Capture ratings, intensity levels, voltage adjustments, or any numeric value within a defined range.",
    },
    {
      id: "checklist",
      name: "Interactive Checklist",
      description: "Track completion of multiple items",
      category: "input",
      preview: (
        <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
          <div className="text-xs font-semibold mb-2">Pre-Flight Safety Checks</div>
          {Object.entries(demoChecklist).map(([key, checked]) => (
            <div key={key} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={key}
                checked={checked}
                onChange={(e) =>
                  setDemoChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                }
                className="mt-1 h-4 w-4 rounded border-border cursor-pointer"
              />
              <label htmlFor={key} className="flex-1 cursor-pointer">
                <div className="text-xs">
                  {key === "item1" && "Power disconnected from mains"}
                  {key === "item2" && "All cabinet doors locked"}
                  {key === "item3" && "Work area clear of obstructions"}
                </div>
              </label>
            </div>
          ))}
        </div>
      ),
      code: `{
  "type": "checklist",
  "id": "safety-checks",
  "data": {
    "title": "Pre-Flight Safety Checks",
    "items": [
      {
        "label": "Power disconnected from mains",
        "checked": false
      },
      {
        "label": "All cabinet doors locked",
        "checked": false
      },
      {
        "label": "Work area clear of obstructions",
        "checked": false
      }
    ]
  }
}`,
      useCase: "Guide users through multi-step procedures, safety checks, or diagnostic verification steps.",
    },
    {
      id: "form",
      name: "Multi-Field Form",
      description: "Collect multiple related inputs",
      category: "input",
      preview: (
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
          <h4 className="text-sm font-semibold">Report an Issue</h4>
          <p className="text-xs text-muted-foreground">Provide details about the problem</p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="issue-type" className="text-xs font-medium">
                Issue Type <span className="text-destructive">*</span>
              </Label>
              <Select>
                <SelectTrigger id="issue-type" className="text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hardware" className="text-xs">
                    Hardware
                  </SelectItem>
                  <SelectItem value="software" className="text-xs">
                    Software
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="description" className="text-xs font-medium">
                Description <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="description"
                placeholder="Describe the issue in detail..."
                className="w-full min-h-[80px] px-3 py-2 text-xs rounded-md border border-input bg-background"
              />
            </div>
          </div>
          <Button size="sm" className="w-full">
            Submit Report
          </Button>
        </div>
      ),
      code: `{
  "type": "form",
  "id": "issue-report-form",
  "data": {
    "title": "Report an Issue",
    "description": "Provide details about the problem",
    "fields": [
      {
        "name": "issue_type",
        "label": "Issue Type",
        "type": "select",
        "required": true,
        "placeholder": "Select type",
        "options": [
          { "value": "hardware", "label": "Hardware" },
          { "value": "software", "label": "Software" }
        ]
      },
      {
        "name": "description",
        "label": "Description",
        "type": "textarea",
        "required": true,
        "placeholder": "Describe the issue in detail...",
        "maxLength": 500
      }
    ],
    "submitLabel": "Submit Report"
  }
}`,
      useCase: "Gather comprehensive diagnostic information in a structured format for complex troubleshooting scenarios.",
    },
    {
      id: "code",
      name: "Code Block",
      description: "Display code snippets or commands",
      category: "display",
      preview: (
        <div className="p-4 bg-black/50 rounded-lg border border-border font-mono text-xs overflow-x-auto">
          <pre className="text-primary">
            {`sudo systemctl restart arcade-service
journalctl -u arcade-service -n 50`}
          </pre>
        </div>
      ),
      code: `{
  "type": "code",
  "id": "terminal-commands",
  "data": {
    "code": "sudo systemctl restart arcade-service\\njournalctl -u arcade-service -n 50"
  }
}`,
      useCase: "Show terminal commands, configuration snippets, or code examples that users need to execute.",
    },
  ];

  const categories = {
    input: componentExamples.filter((c) => c.category === "input"),
    feedback: componentExamples.filter((c) => c.category === "feedback"),
    action: componentExamples.filter((c) => c.category === "action"),
    display: componentExamples.filter((c) => c.category === "display"),
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Component Library
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Interactive Component Library
          </DialogTitle>
          <DialogDescription>
            All available interactive components with live previews and backend integration examples
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({componentExamples.length})</TabsTrigger>
            <TabsTrigger value="input">Input ({categories.input.length})</TabsTrigger>
            <TabsTrigger value="feedback">Feedback ({categories.feedback.length})</TabsTrigger>
            <TabsTrigger value="action">Action ({categories.action.length})</TabsTrigger>
            <TabsTrigger value="display">Display ({categories.display.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {componentExamples.map((example) => (
              <ComponentCard
                key={example.id}
                example={example}
                copiedId={copiedId}
                onCopy={copyToClipboard}
              />
            ))}
          </TabsContent>

          <TabsContent value="input" className="space-y-4 mt-4">
            {categories.input.map((example) => (
              <ComponentCard
                key={example.id}
                example={example}
                copiedId={copiedId}
                onCopy={copyToClipboard}
              />
            ))}
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4 mt-4">
            {categories.feedback.map((example) => (
              <ComponentCard
                key={example.id}
                example={example}
                copiedId={copiedId}
                onCopy={copyToClipboard}
              />
            ))}
          </TabsContent>

          <TabsContent value="action" className="space-y-4 mt-4">
            {categories.action.map((example) => (
              <ComponentCard
                key={example.id}
                example={example}
                copiedId={copiedId}
                onCopy={copyToClipboard}
              />
            ))}
          </TabsContent>

          <TabsContent value="display" className="space-y-4 mt-4">
            {categories.display.map((example) => (
              <ComponentCard
                key={example.id}
                example={example}
                copiedId={copiedId}
                onCopy={copyToClipboard}
              />
            ))}
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Backend Integration Guide
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            To use these components in your AI responses, include them in the <code className="px-1 py-0.5 bg-background rounded">interactive_components</code> array:
          </p>
          <div className="p-3 bg-black/50 rounded font-mono text-xs overflow-x-auto">
            <pre className="text-primary">
{`{
  "summary": "Let's check the power supply...",
  "interactive_components": [
    {
      "type": "progress",
      "id": "diagnostic-progress",
      "data": { "label": "Running Test", "value": 45 }
    },
    {
      "type": "button_group",
      "id": "symptoms",
      "data": {
        "title": "What are you experiencing?",
        "buttons": [...]
      }
    }
  ],
  "steps": [...]
}`}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComponentCard({
  example,
  copiedId,
  onCopy,
}: {
  example: ComponentExample;
  copiedId: string | null;
  onCopy: (code: string, id: string) => void;
}) {
  const [showCode, setShowCode] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {example.name}
              <Badge variant="outline" className="text-xs">
                {example.category}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-1">{example.description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCode(!showCode)}
              className="h-8 w-8 p-0"
            >
              {showCode ? <Eye className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopy(example.code, example.id)}
              className="h-8 w-8 p-0"
            >
              {copiedId === example.id ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showCode ? (
          <>
            <div className="p-4 bg-background rounded-lg border border-border">
              {example.preview}
            </div>
            <div className="p-3 bg-muted/30 rounded-lg border-l-4 border-l-primary">
              <div className="text-xs font-medium mb-1">Use Case</div>
              <p className="text-xs text-muted-foreground">{example.useCase}</p>
            </div>
          </>
        ) : (
          <div className="p-4 bg-black/50 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-primary">Backend JSON Structure</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(example.code, example.id)}
                className="h-6 text-xs"
              >
                {copiedId === example.id ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="text-xs text-primary overflow-x-auto">{example.code}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
