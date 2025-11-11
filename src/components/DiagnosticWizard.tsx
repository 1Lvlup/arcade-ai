import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WizardField {
  id: string;
  type: "text" | "select" | "radio" | "textarea";
  label: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  fields: WizardField[];
  nextStep?: (answers: Record<string, string>) => string | null;
  isComplete?: (answers: Record<string, string>) => boolean;
}

interface DiagnosticWizardProps {
  scenario: "power" | "display" | "audio" | "network" | "custom";
  onComplete?: (results: Record<string, string>, analysis?: any) => void;
  customSteps?: WizardStep[];
  manualId?: string;
  deviceType?: string;
}

const TROUBLESHOOTING_SCENARIOS: Record<string, WizardStep[]> = {
  power: [
    {
      id: "initial",
      title: "Power Issue Diagnosis",
      description: "Let's identify the power problem",
      fields: [
        {
          id: "device_type",
          type: "select",
          label: "What type of device?",
          options: [
            { value: "desktop", label: "Desktop Computer" },
            { value: "laptop", label: "Laptop" },
            { value: "monitor", label: "Monitor" },
            { value: "other", label: "Other" }
          ],
          required: true
        },
        {
          id: "power_state",
          type: "radio",
          label: "What happens when you press the power button?",
          options: [
            { value: "nothing", label: "Nothing happens at all" },
            { value: "lights_only", label: "Lights turn on but no display" },
            { value: "beeps", label: "Makes beeping sounds" },
            { value: "starts_stops", label: "Starts then immediately stops" }
          ],
          required: true
        }
      ],
      nextStep: (answers) => {
        if (answers.power_state === "nothing") return "no_power";
        if (answers.power_state === "lights_only") return "display_issue";
        if (answers.power_state === "beeps") return "hardware_error";
        return "power_cycle";
      }
    },
    {
      id: "no_power",
      title: "No Power Response",
      description: "The device is not receiving power",
      fields: [
        {
          id: "cable_check",
          type: "radio",
          label: "Is the power cable firmly connected?",
          options: [
            { value: "yes", label: "Yes, it's connected properly" },
            { value: "no", label: "No, it was loose" },
            { value: "unsure", label: "Not sure" }
          ],
          required: true
        },
        {
          id: "outlet_test",
          type: "radio",
          label: "Have you tested the power outlet with another device?",
          options: [
            { value: "works", label: "Yes, outlet works" },
            { value: "no_power", label: "Outlet has no power" },
            { value: "not_tested", label: "Haven't tested" }
          ],
          required: true
        }
      ],
      isComplete: (answers) => answers.outlet_test === "works" && answers.cable_check === "yes"
    },
    {
      id: "display_issue",
      title: "Display Connection Issue",
      description: "Power is on but no display",
      fields: [
        {
          id: "display_cable",
          type: "radio",
          label: "Is the display cable connected?",
          options: [
            { value: "connected", label: "Yes, properly connected" },
            { value: "loose", label: "It was loose, I reconnected it" },
            { value: "no_cable", label: "No cable connected" }
          ],
          required: true
        },
        {
          id: "external_monitor",
          type: "radio",
          label: "If laptop, does external monitor work?",
          options: [
            { value: "yes", label: "Yes, external works" },
            { value: "no", label: "No, external doesn't work either" },
            { value: "na", label: "Not a laptop / No external monitor" }
          ],
          required: true
        }
      ],
      isComplete: () => true
    },
    {
      id: "hardware_error",
      title: "Hardware Error Diagnosis",
      description: "Beep codes indicate hardware issues",
      fields: [
        {
          id: "beep_pattern",
          type: "text",
          label: "Describe the beep pattern (e.g., 3 short beeps, 1 long 2 short)",
          placeholder: "e.g., 3 short beeps",
          required: true
        },
        {
          id: "recent_changes",
          type: "textarea",
          label: "Any recent hardware changes or installations?",
          placeholder: "Describe any recent changes...",
          required: false
        }
      ],
      isComplete: () => true
    },
    {
      id: "power_cycle",
      title: "Power Cycle Test",
      description: "Let's try a complete power reset",
      fields: [
        {
          id: "power_cycle_done",
          type: "radio",
          label: "Unplug the device for 30 seconds, then plug back in. Did this help?",
          options: [
            { value: "fixed", label: "Yes, device now works!" },
            { value: "no_change", label: "No change" },
            { value: "worse", label: "Made it worse" }
          ],
          required: true
        }
      ],
      isComplete: () => true
    }
  ],
  display: [
    {
      id: "initial",
      title: "Display Problem Diagnosis",
      description: "Let's identify the display issue",
      fields: [
        {
          id: "issue_type",
          type: "radio",
          label: "What's the display problem?",
          options: [
            { value: "no_display", label: "No display at all" },
            { value: "distorted", label: "Distorted or garbled image" },
            { value: "flickering", label: "Flickering or intermittent" },
            { value: "wrong_resolution", label: "Wrong resolution or aspect ratio" }
          ],
          required: true
        }
      ],
      nextStep: (answers) => {
        return answers.issue_type === "no_display" ? "no_display" : "display_quality";
      }
    },
    {
      id: "no_display",
      title: "No Display Troubleshooting",
      description: "Display is completely blank",
      fields: [
        {
          id: "power_led",
          type: "radio",
          label: "Is the monitor's power LED on?",
          options: [
            { value: "on", label: "Yes, LED is on" },
            { value: "off", label: "No, LED is off" },
            { value: "blinking", label: "LED is blinking" }
          ],
          required: true
        },
        {
          id: "input_source",
          type: "radio",
          label: "Have you checked the monitor's input source?",
          options: [
            { value: "correct", label: "Yes, it's on the correct input" },
            { value: "changed", label: "Changed it, now works!" },
            { value: "unsure", label: "Not sure how to check" }
          ],
          required: true
        }
      ],
      isComplete: () => true
    },
    {
      id: "display_quality",
      title: "Display Quality Issues",
      description: "Image quality or display problems",
      fields: [
        {
          id: "cable_type",
          type: "select",
          label: "What type of cable are you using?",
          options: [
            { value: "hdmi", label: "HDMI" },
            { value: "displayport", label: "DisplayPort" },
            { value: "dvi", label: "DVI" },
            { value: "vga", label: "VGA" }
          ],
          required: true
        },
        {
          id: "cable_condition",
          type: "radio",
          label: "Is the cable in good condition?",
          options: [
            { value: "good", label: "Yes, looks fine" },
            { value: "damaged", label: "Appears damaged" },
            { value: "old", label: "Very old cable" }
          ],
          required: true
        }
      ],
      isComplete: () => true
    }
  ],
  audio: [
    {
      id: "initial",
      title: "Audio Problem Diagnosis",
      description: "Let's identify the audio issue",
      fields: [
        {
          id: "audio_issue",
          type: "radio",
          label: "What's the audio problem?",
          options: [
            { value: "no_sound", label: "No sound at all" },
            { value: "distorted", label: "Distorted or crackling sound" },
            { value: "one_channel", label: "Only one speaker working" },
            { value: "intermittent", label: "Intermittent audio" }
          ],
          required: true
        },
        {
          id: "device_type",
          type: "select",
          label: "What audio device?",
          options: [
            { value: "speakers", label: "External Speakers" },
            { value: "headphones", label: "Headphones" },
            { value: "builtin", label: "Built-in Speakers" },
            { value: "bluetooth", label: "Bluetooth Device" }
          ],
          required: true
        }
      ],
      nextStep: (answers) => {
        return answers.audio_issue === "no_sound" ? "no_audio" : "audio_quality";
      }
    },
    {
      id: "no_audio",
      title: "No Audio Output",
      description: "Device is completely silent",
      fields: [
        {
          id: "volume_check",
          type: "radio",
          label: "Is the system volume turned up?",
          options: [
            { value: "yes", label: "Yes, volume is up" },
            { value: "was_muted", label: "It was muted, unmuted now" },
            { value: "max", label: "Volume at maximum" }
          ],
          required: true
        },
        {
          id: "output_device",
          type: "radio",
          label: "Is the correct output device selected?",
          options: [
            { value: "correct", label: "Yes, correct device" },
            { value: "wrong", label: "Wrong device was selected" },
            { value: "unsure", label: "Not sure how to check" }
          ],
          required: true
        }
      ],
      isComplete: () => true
    },
    {
      id: "audio_quality",
      title: "Audio Quality Issues",
      description: "Sound quality problems",
      fields: [
        {
          id: "connection_type",
          type: "radio",
          label: "How is the device connected?",
          options: [
            { value: "3.5mm", label: "3.5mm jack" },
            { value: "usb", label: "USB" },
            { value: "bluetooth", label: "Bluetooth" },
            { value: "other", label: "Other" }
          ],
          required: true
        },
        {
          id: "driver_update",
          type: "radio",
          label: "Have you updated audio drivers recently?",
          options: [
            { value: "yes", label: "Yes, drivers are updated" },
            { value: "no", label: "No, haven't updated" },
            { value: "unsure", label: "Not sure" }
          ],
          required: true
        }
      ],
      isComplete: () => true
    }
  ],
  network: [
    {
      id: "initial",
      title: "Network Issue Diagnosis",
      description: "Let's troubleshoot your network connection",
      fields: [
        {
          id: "connection_type",
          type: "radio",
          label: "How are you connecting?",
          options: [
            { value: "wifi", label: "WiFi" },
            { value: "ethernet", label: "Ethernet Cable" },
            { value: "mobile", label: "Mobile Hotspot" }
          ],
          required: true
        },
        {
          id: "issue_type",
          type: "radio",
          label: "What's the problem?",
          options: [
            { value: "no_connection", label: "Can't connect at all" },
            { value: "slow", label: "Very slow connection" },
            { value: "intermittent", label: "Connection drops frequently" },
            { value: "limited", label: "Limited or no internet access" }
          ],
          required: true
        }
      ],
      nextStep: (answers) => {
        if (answers.connection_type === "wifi") return "wifi_issues";
        if (answers.connection_type === "ethernet") return "ethernet_issues";
        return "general_network";
      }
    },
    {
      id: "wifi_issues",
      title: "WiFi Connection Problems",
      description: "Diagnosing WiFi issues",
      fields: [
        {
          id: "network_visible",
          type: "radio",
          label: "Can you see your WiFi network in the list?",
          options: [
            { value: "yes", label: "Yes, I can see it" },
            { value: "no", label: "No, it's not showing" },
            { value: "other_networks", label: "See other networks but not mine" }
          ],
          required: true
        },
        {
          id: "router_restart",
          type: "radio",
          label: "Have you restarted your router?",
          options: [
            { value: "yes_worked", label: "Yes, and it fixed it!" },
            { value: "yes_no_change", label: "Yes, but no change" },
            { value: "no", label: "Haven't tried yet" }
          ],
          required: true
        }
      ],
      isComplete: () => true
    },
    {
      id: "ethernet_issues",
      title: "Ethernet Connection Problems",
      description: "Diagnosing wired connection",
      fields: [
        {
          id: "cable_connected",
          type: "radio",
          label: "Is the ethernet cable firmly connected?",
          options: [
            { value: "yes", label: "Yes, properly connected both ends" },
            { value: "reconnected", label: "Reconnected it" },
            { value: "loose", label: "One end was loose" }
          ],
          required: true
        },
        {
          id: "link_lights",
          type: "radio",
          label: "Are the link lights on the ethernet port lit?",
          options: [
            { value: "yes", label: "Yes, lights are on" },
            { value: "no", label: "No lights" },
            { value: "unsure", label: "Don't know where to look" }
          ],
          required: true
        }
      ],
      isComplete: () => true
    },
    {
      id: "general_network",
      title: "General Network Diagnostics",
      description: "Additional network checks",
      fields: [
        {
          id: "other_devices",
          type: "radio",
          label: "Do other devices work on the same network?",
          options: [
            { value: "yes", label: "Yes, other devices work fine" },
            { value: "no", label: "No, nothing works" },
            { value: "no_other", label: "No other devices to test" }
          ],
          required: true
        },
        {
          id: "dns_test",
          type: "textarea",
          label: "Additional notes or error messages",
          placeholder: "Any error messages or additional details...",
          required: false
        }
      ],
      isComplete: () => true
    }
  ]
};

export function DiagnosticWizard({ scenario, onComplete, customSteps, manualId, deviceType }: DiagnosticWizardProps) {
  const steps = customSteps || TROUBLESHOOTING_SCENARIOS[scenario] || [];
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stepHistory, setStepHistory] = useState<string[]>(["initial"]);
  const [isComplete, setIsComplete] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const currentStep = steps.find(s => s.id === stepHistory[currentStepIndex]);

  if (!currentStep) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Configuration Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Invalid wizard configuration</p>
        </CardContent>
      </Card>
    );
  }

  const progress = ((currentStepIndex + 1) / stepHistory.length) * 100;

  const handleFieldChange = (fieldId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const analyzeResults = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-diagnostic-wizard', {
        body: {
          scenario,
          results: answers,
          device_context: {
            manual_id: manualId,
            device_type: deviceType || answers.device_type,
          }
        }
      });

      if (error) throw error;

      setIsComplete(true);
      onComplete?.(answers, data);
    } catch (error) {
      console.error('Error analyzing diagnostic wizard:', error);
      setIsComplete(true);
      onComplete?.(answers, null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNext = () => {
    const requiredFieldsFilled = currentStep.fields
      .filter(f => f.required)
      .every(f => answers[f.id]);

    if (!requiredFieldsFilled) {
      return;
    }

    if (currentStep.nextStep) {
      const nextStepId = currentStep.nextStep(answers);
      if (nextStepId) {
        const newHistory = [...stepHistory.slice(0, currentStepIndex + 1), nextStepId];
        setStepHistory(newHistory);
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        // No next step means we're done - analyze results
        analyzeResults();
      }
    } else if (currentStep.isComplete) {
      // This is a final step - analyze results
      analyzeResults();
    } else {
      // Move to next step in sequence if it exists
      if (currentStepIndex < steps.length - 1) {
        const nextStep = steps[currentStepIndex + 1];
        const newHistory = [...stepHistory.slice(0, currentStepIndex + 1), nextStep.id];
        setStepHistory(newHistory);
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        analyzeResults();
      }
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const renderField = (field: WizardField) => {
    switch (field.type) {
      case "text":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              value={answers[field.id] || ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
            />
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              value={answers[field.id] || ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
            />
          </div>
        );

      case "select":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
              value={answers[field.id] || ""}
              onValueChange={(value) => handleFieldChange(field.id, value)}
            >
              <SelectTrigger id={field.id}>
                <SelectValue placeholder={field.placeholder || "Select an option"} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "radio":
        return (
          <div key={field.id} className="space-y-3">
            <Label>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <RadioGroup
              value={answers[field.id] || ""}
              onValueChange={(value) => handleFieldChange(field.id, value)}
            >
              {field.options?.map(opt => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`${field.id}-${opt.value}`} />
                  <Label htmlFor={`${field.id}-${opt.value}`} className="font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      default:
        return null;
    }
  };

  if (isAnalyzing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analyzing Diagnostic Results
          </CardTitle>
          <CardDescription>
            Our AI is analyzing your responses to provide personalized recommendations...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            {Object.entries(answers).map(([key, value]) => (
              <div key={key} className="text-sm">
                <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>{" "}
                <span className="text-muted-foreground">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isComplete) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Diagnosis Complete
          </CardTitle>
          <CardDescription>
            Analysis complete. Recommendations are displayed above.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const canProceed = currentStep.fields
    .filter(f => f.required)
    .every(f => answers[f.id]);

  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle>{currentStep.title}</CardTitle>
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {stepHistory.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <CardDescription>{currentStep.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentStep.fields.map(renderField)}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStepIndex === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed}
        >
          {currentStep.isComplete || !currentStep.nextStep ? "Complete" : "Next"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}
