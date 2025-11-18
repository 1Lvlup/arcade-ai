import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Save, Phone } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PredictedObjection {
  objection: string;
  root_cause_hypotheses: string[];
  severity_score: number;
  probability_score: number;
  cluster: string;
  stage_pattern: string;
  persona_pattern: string;
  primary_response: string;
  alternative_frames: string[];
  follow_up_questions: string[];
  suggested_next_steps: string[];
}

interface Lead {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  lead_score: number | null;
  priority_tier: string | null;
  stage: string | null;
  company_id: string | null;
  companies: any;
}

interface Activity {
  id: string;
  activity_type: string | null;
  content: string | null;
  timestamp: string | null;
}

interface Props {
  lead: Lead;
  activities: Activity[];
}

export function PredictedObjectionsSection({ lead, activities }: Props) {
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<PredictedObjection[]>([]);
  const [selectedObjection, setSelectedObjection] = useState<PredictedObjection | null>(null);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const predictObjections = async () => {
    setLoading(true);
    try {
      // Get most recent discovery summary
      const discoverySummary = activities.find(a => a.activity_type === 'discovery_summary');

      const payload = {
        lead: {
          name: lead.name,
          role: lead.role,
          email: lead.email,
          phone: lead.phone,
          lead_score: lead.lead_score,
          priority_tier: lead.priority_tier,
        },
        company: lead.companies,
        discovery: discoverySummary ? JSON.parse(discoverySummary.content || '{}') : null,
        stage: lead.stage || 'unknown',
      };

      const { data, error } = await supabase.functions.invoke('predictive-objection-engine', {
        body: payload
      });

      if (error) throw error;

      if (data.predicted_objections) {
        setPredictions(data.predicted_objections);
        setIsOpen(true);
        toast({ title: "Objections predicted successfully" });
      } else {
        throw new Error("No predictions returned");
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Failed to predict objections",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveToLibrary = async (objection: PredictedObjection) => {
    try {
      const { error } = await supabase.from('objections').insert({
        title: `[Predicted] ${objection.cluster} - ${objection.objection.substring(0, 40)}`,
        objection_text: objection.objection,
        persona: lead.role || objection.persona_pattern,
        stage: lead.stage,
        cluster: objection.cluster,
        severity_score: objection.severity_score,
        probability_score: objection.probability_score,
        persona_pattern: objection.persona_pattern,
        stage_pattern: objection.stage_pattern,
        root_cause_hypotheses: objection.root_cause_hypotheses,
        primary_response: objection.primary_response,
        alternative_frames: objection.alternative_frames,
        follow_up_questions: objection.follow_up_questions,
        suggested_next_steps: objection.suggested_next_steps,
      });

      if (error) throw error;

      toast({ title: "Objection saved to library" });
    } catch (error) {
      console.error("Error saving objection:", error);
      toast({
        title: "Failed to save objection",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const openCallModal = (objection: PredictedObjection) => {
    setSelectedObjection(objection);
    setCallModalOpen(true);
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Predicted Objections (AI)
                </CardTitle>
                <CardDescription>AI-powered objection forecasting based on lead profile</CardDescription>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  {isOpen ? "Collapse" : "Expand"}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {predictions.length === 0 ? (
                <Button onClick={predictObjections} disabled={loading}>
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Predict Objections</>
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  {predictions.map((obj, idx) => (
                    <Card key={idx} className="border-l-4" style={{
                      borderLeftColor: obj.severity_score >= 7 ? '#ef4444' : 
                                      obj.severity_score >= 4 ? '#f59e0b' : '#10b981'
                    }}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{obj.objection}</CardTitle>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline">
                                Severity: {obj.severity_score}/10
                              </Badge>
                              <Badge variant="outline">
                                Probability: {obj.probability_score}%
                              </Badge>
                              <Badge>{obj.cluster}</Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Primary Response:</p>
                          <p className="text-sm text-muted-foreground">{obj.primary_response}</p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openCallModal(obj)}>
                            <Phone className="h-4 w-4 mr-1" />
                            Use in Call
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => saveToLibrary(obj)}>
                            <Save className="h-4 w-4 mr-1" />
                            Save to Library
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  <Button variant="ghost" onClick={predictObjections} disabled={loading}>
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Re-analyzing...</>
                    ) : (
                      "Re-predict Objections"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Call Support Modal */}
      <Dialog open={callModalOpen} onOpenChange={setCallModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Live Call Support</DialogTitle>
            <DialogDescription>Quick reference for handling this objection</DialogDescription>
          </DialogHeader>
          
          {selectedObjection && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Objection</h4>
                <p className="text-sm text-muted-foreground">{selectedObjection.objection}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Primary Response</h4>
                <p className="text-sm">{selectedObjection.primary_response}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Top Alternative Frame</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedObjection.alternative_frames[0] || "N/A"}
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Follow-up Questions</h4>
                <ul className="list-disc list-inside space-y-1">
                  {selectedObjection.follow_up_questions.slice(0, 3).map((q, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">{q}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Suggested Next Steps</h4>
                <ul className="list-disc list-inside space-y-1">
                  {selectedObjection.suggested_next_steps.map((step, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
