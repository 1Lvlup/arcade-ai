import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Clock, Download, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TroubleshootingStep {
  step_number: number;
  step_label: string;
  summary: string;
  next_actions: string[];
  questions_for_tech: string[] | null;
  assumptions: string[] | null;
  checks_performed: string[] | null;
  results_expected: string[] | null;
  branch_logic: string | null;
  status: string;
  tech_response: string | null;
  created_at: string;
}

interface SessionSummary {
  session_id: string;
  game_name: string | null;
  symptom: string;
  status: string;
  location_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  steps: TroubleshootingStep[];
}

interface SessionSummaryCardProps {
  session: SessionSummary;
  onExport?: () => void;
}

export function SessionSummaryCard({ session, onExport }: SessionSummaryCardProps) {
  const duration = session.completed_at
    ? formatDistanceToNow(new Date(session.created_at), { addSuffix: false })
    : "In progress";

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case 'escalated':
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case 'stalled':
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{session.game_name || 'Unknown Game'}</CardTitle>
            <CardDescription className="mt-1">{session.symptom}</CardDescription>
          </div>
          <Badge variant="outline" className={getStatusColor(session.status)}>
            {session.status}
          </Badge>
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          {session.location_name && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {session.location_name}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {duration}
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            {session.steps.length} steps
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Accordion type="single" collapsible className="w-full">
          {session.steps.map((step) => (
            <AccordionItem key={step.step_number} value={`step-${step.step_number}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <Badge variant="outline" className="text-xs">
                    Step {step.step_number}
                  </Badge>
                  <span className="font-medium">{step.step_label}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {step.summary}
                  </p>
                </div>

                {step.next_actions && step.next_actions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Actions Taken:</h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {step.next_actions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {step.checks_performed && step.checks_performed.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Checks Performed:</h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {step.checks_performed.map((check, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>{check}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {step.tech_response && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium mb-1">Tech Response:</h5>
                    <p className="text-sm text-muted-foreground">{step.tech_response}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(step.created_at), { addSuffix: true })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {onExport && (
          <Button onClick={onExport} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Export Session Report
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
