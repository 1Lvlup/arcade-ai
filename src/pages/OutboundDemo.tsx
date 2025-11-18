import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SharedHeader } from "@/components/SharedHeader";
import { OutboundNav } from "@/components/OutboundNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const OutboundDemo = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Demo Planner state
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [demoNotes, setDemoNotes] = useState("");
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [demoPlan, setDemoPlan] = useState<any>(null);

  // Objection Generator state
  const [objectionPersona, setObjectionPersona] = useState("gm");
  const [objectionStage, setObjectionStage] = useState("discovery");
  const [objectionText, setObjectionText] = useState("");
  const [objectionContext, setObjectionContext] = useState("");
  const [isGeneratingObjection, setIsGeneratingObjection] = useState(false);
  const [objectionPattern, setObjectionPattern] = useState<any>(null);

  // Objection Library filters
  const [objectionPersonaFilter, setObjectionPersonaFilter] = useState("all");
  const [objectionStageFilter, setObjectionStageFilter] = useState("all");
  const [selectedObjection, setSelectedObjection] = useState<any>(null);

  // Fetch leads for dropdown
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-demo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*, companies(*)')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch demo plans for selected lead
  const { data: demoPlans = [] } = useQuery({
    queryKey: ['demo-plans', selectedLeadId],
    enabled: !!selectedLeadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', selectedLeadId)
        .eq('activity_type', 'demo_plan')
        .order('timestamp', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch objections library
  const { data: objections = [] } = useQuery({
    queryKey: ['objections', objectionPersonaFilter, objectionStageFilter],
    queryFn: async () => {
      let query = supabase.from('objections').select('*').order('created_at', { ascending: false });
      
      if (objectionPersonaFilter !== 'all') {
        query = query.eq('persona', objectionPersonaFilter);
      }
      if (objectionStageFilter !== 'all') {
        query = query.eq('stage', objectionStageFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const handleGenerateDemoPlan = async () => {
    if (!selectedLeadId) {
      toast({ title: "Error", description: "Please select a lead first", variant: "destructive" });
      return;
    }

    setIsGeneratingDemo(true);
    try {
      const selectedLead = leads.find(l => l.id === selectedLeadId);
      if (!selectedLead) throw new Error("Lead not found");

      // Fetch discovery summary if exists
      const { data: discoveryActivities } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', selectedLeadId)
        .eq('activity_type', 'discovery_summary')
        .order('timestamp', { ascending: false })
        .limit(1);

      const discovery = discoveryActivities && discoveryActivities.length > 0
        ? JSON.parse(discoveryActivities[0].content)
        : null;

      const payload = {
        lead: selectedLead,
        discovery,
        notes: demoNotes || undefined
      };

      const { data, error } = await supabase.functions.invoke("demo-engine", { body: payload });

      if (error) throw error;
      setDemoPlan(data);
      toast({ title: "Success", description: "Demo plan generated successfully" });
    } catch (error: any) {
      console.error("Error generating demo plan:", error);
      toast({ title: "Error", description: error.message || "Failed to generate demo plan", variant: "destructive" });
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const saveDemoPlanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLeadId || !demoPlan) throw new Error("No demo plan to save");

      const selectedLead = leads.find(l => l.id === selectedLeadId);
      const { error } = await supabase.from('activities').insert({
        lead_id: selectedLeadId,
        company_id: selectedLead?.company_id,
        activity_type: 'demo_plan',
        content: JSON.stringify(demoPlan),
        timestamp: new Date().toISOString()
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-plans', selectedLeadId] });
      toast({ title: "Success", description: "Demo plan saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save demo plan", variant: "destructive" });
    }
  });

  const handleGenerateObjection = async () => {
    if (!objectionText.trim()) {
      toast({ title: "Error", description: "Please enter an objection", variant: "destructive" });
      return;
    }

    setIsGeneratingObjection(true);
    try {
      const payload = {
        objection: objectionText,
        persona: objectionPersona,
        stage: objectionStage,
        context: objectionContext || undefined
      };

      const { data, error } = await supabase.functions.invoke("objection-engine", { body: payload });

      if (error) throw error;
      setObjectionPattern(data);
      toast({ title: "Success", description: "Objection pattern generated" });
    } catch (error: any) {
      console.error("Error generating objection:", error);
      toast({ title: "Error", description: error.message || "Failed to generate objection pattern", variant: "destructive" });
    } finally {
      setIsGeneratingObjection(false);
    }
  };

  const saveObjectionMutation = useMutation({
    mutationFn: async () => {
      if (!objectionPattern) throw new Error("No objection pattern to save");

      const title = `[${objectionStage}] – [${objectionPersona}] – ${objectionPattern.objection?.substring(0, 40) || objectionText.substring(0, 40)}`;

      const { error } = await supabase.from('objections').insert({
        title,
        persona: objectionPersona,
        stage: objectionStage,
        objection_text: objectionPattern.objection || objectionText,
        root_cause_hypotheses: objectionPattern.root_cause_hypotheses || [],
        primary_response: objectionPattern.primary_response || "",
        alternative_frames: objectionPattern.alternative_frames || [],
        follow_up_questions: objectionPattern.follow_up_questions || [],
        suggested_next_steps: objectionPattern.suggested_next_steps || []
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objections'] });
      toast({ title: "Success", description: "Objection saved to library" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save objection", variant: "destructive" });
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Outbound – Demo & Objections" showBackButton backTo="/" />
      
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Demo Planner Section */}
          <Card>
            <CardHeader>
              <CardTitle>Demo Planner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Lead</Label>
                <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name} – {lead.companies?.name || 'No Company'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Additional Notes / Focus for This Demo</Label>
                <Textarea
                  value={demoNotes}
                  onChange={(e) => setDemoNotes(e.target.value)}
                  placeholder="Optional: specific areas to focus on..."
                  rows={3}
                />
              </div>

              <Button onClick={handleGenerateDemoPlan} disabled={isGeneratingDemo || !selectedLeadId} className="w-full">
                {isGeneratingDemo ? "Generating..." : "Generate Demo Plan"}
              </Button>

              {demoPlan && (
                <div className="mt-4 p-4 border rounded-lg space-y-3">
                  <h3 className="font-semibold text-lg">{demoPlan.demo_title}</h3>
                  
                  <div>
                    <h4 className="font-medium">Agenda:</h4>
                    <ul className="list-disc list-inside">
                      {demoPlan.agenda?.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium">Narrative Flow:</h4>
                    <ol className="list-decimal list-inside space-y-2">
                      {demoPlan.narrative_flow?.map((step: any, i: number) => (
                        <li key={i}>
                          <span className="font-medium">{step.label}:</span> {step.talk_track}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-medium">Key Features to Show:</h4>
                    <ul className="list-disc list-inside">
                      {demoPlan.key_features_to_show?.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium">Live Questions to Ask:</h4>
                    <ul className="list-disc list-inside">
                      {demoPlan.live_questions_to_ask?.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium">Post-Demo Follow-ups:</h4>
                    <ul className="list-disc list-inside">
                      {demoPlan.post_demo_followups?.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <Button onClick={() => saveDemoPlanMutation.mutate()} className="w-full mt-4">
                    Save Demo Plan
                  </Button>
                </div>
              )}

              {selectedLeadId && demoPlans.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Previous Demo Plans:</h4>
                  <div className="space-y-2">
                    {demoPlans.map((plan) => (
                      <Collapsible key={plan.id}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 border rounded hover:bg-accent">
                          <span className="text-sm">{new Date(plan.timestamp).toLocaleString()}</span>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="p-2 border-t">
                          <pre className="text-xs whitespace-pre-wrap">{plan.content}</pre>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Objection Generator Section */}
          <Card>
            <CardHeader>
              <CardTitle>Objection Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Persona</Label>
                  <Select value={objectionPersona} onValueChange={setObjectionPersona}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tech">Tech</SelectItem>
                      <SelectItem value="gm">GM</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Stage</Label>
                  <Select value={objectionStage} onValueChange={setObjectionStage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospecting">Prospecting</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                      <SelectItem value="discovery">Discovery</SelectItem>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="close">Close</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Objection (what they said)</Label>
                <Textarea
                  value={objectionText}
                  onChange={(e) => setObjectionText(e.target.value)}
                  placeholder="e.g., 'We don't have budget right now...'"
                  rows={2}
                />
              </div>

              <div>
                <Label>Context (optional)</Label>
                <Textarea
                  value={objectionContext}
                  onChange={(e) => setObjectionContext(e.target.value)}
                  placeholder="Additional context about the situation..."
                  rows={2}
                />
              </div>

              <Button onClick={handleGenerateObjection} disabled={isGeneratingObjection || !objectionText} className="w-full">
                {isGeneratingObjection ? "Generating..." : "Generate Objection Pattern"}
              </Button>

              {objectionPattern && (
                <div className="mt-4 p-4 border rounded-lg space-y-3">
                  <h3 className="font-semibold">{objectionPattern.objection}</h3>

                  <div className="p-3 bg-primary/10 rounded">
                    <h4 className="font-medium">Primary Response:</h4>
                    <p className="font-semibold">{objectionPattern.primary_response}</p>
                  </div>

                  {objectionPattern.root_cause_hypotheses?.length > 0 && (
                    <div>
                      <h4 className="font-medium">Root Causes:</h4>
                      <ul className="list-disc list-inside text-sm">
                        {objectionPattern.root_cause_hypotheses.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {objectionPattern.alternative_frames?.length > 0 && (
                    <div>
                      <h4 className="font-medium">Alternative Frames:</h4>
                      <ul className="list-disc list-inside text-sm">
                        {objectionPattern.alternative_frames.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {objectionPattern.follow_up_questions?.length > 0 && (
                    <div>
                      <h4 className="font-medium">Follow-up Questions:</h4>
                      <ul className="list-disc list-inside text-sm">
                        {objectionPattern.follow_up_questions.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {objectionPattern.suggested_next_steps?.length > 0 && (
                    <div>
                      <h4 className="font-medium">Next Steps:</h4>
                      <ul className="list-disc list-inside text-sm">
                        {objectionPattern.suggested_next_steps.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button onClick={() => saveObjectionMutation.mutate()} className="w-full mt-4">
                    Save to Objection Library
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-6" />

        {/* Objection Library */}
        <Card>
          <CardHeader>
            <CardTitle>Objection Library</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <Label>Persona Filter</Label>
                <Select value={objectionPersonaFilter} onValueChange={setObjectionPersonaFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="tech">Tech</SelectItem>
                    <SelectItem value="gm">GM</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <Label>Stage Filter</Label>
                <Select value={objectionStageFilter} onValueChange={setObjectionStageFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="prospecting">Prospecting</SelectItem>
                    <SelectItem value="outreach">Outreach</SelectItem>
                    <SelectItem value="discovery">Discovery</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="close">Close</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {objections.map((obj) => (
                <Collapsible key={obj.id}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 border rounded hover:bg-accent">
                    <div className="flex-1 text-left">
                      <p className="font-medium">{obj.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {obj.persona} • {obj.stage} • {new Date(obj.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-4 border-t space-y-3">
                    <div>
                      <h4 className="font-medium">Objection:</h4>
                      <p className="text-sm">{obj.objection_text}</p>
                    </div>

                    <div className="p-3 bg-primary/10 rounded">
                      <h4 className="font-medium">Primary Response:</h4>
                      <p className="font-semibold text-sm">{obj.primary_response}</p>
                    </div>

                    {obj.alternative_frames && Array.isArray(obj.alternative_frames) && obj.alternative_frames.length > 0 && (
                      <div>
                        <h4 className="font-medium">Alternative Frames:</h4>
                        <ul className="list-disc list-inside text-sm">
                          {obj.alternative_frames.map((frame, i: number) => (
                            <li key={i}>{String(frame)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {obj.follow_up_questions && Array.isArray(obj.follow_up_questions) && obj.follow_up_questions.length > 0 && (
                      <div>
                        <h4 className="font-medium">Follow-up Questions:</h4>
                        <ul className="list-disc list-inside text-sm">
                          {obj.follow_up_questions.map((q, i: number) => (
                            <li key={i}>{String(q)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {obj.suggested_next_steps && Array.isArray(obj.suggested_next_steps) && obj.suggested_next_steps.length > 0 && (
                      <div>
                        <h4 className="font-medium">Next Steps:</h4>
                        <ul className="list-disc list-inside text-sm">
                          {obj.suggested_next_steps.map((step, i: number) => (
                            <li key={i}>{String(step)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}

              {objections.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No objections in library yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OutboundDemo;
