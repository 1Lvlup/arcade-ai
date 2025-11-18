import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SharedHeader } from "@/components/SharedHeader";
import { OutboundNav } from "@/components/OutboundNav";

interface LeadData {
  company_name: string;
  location: string;
  website: string;
  estimated_game_count: number;
  has_vr: boolean;
  has_redemption: boolean;
  has_bowling: boolean;
  contacts: Array<{
    name: string;
    role: string;
    email: string;
    phone: string;
  }>;
  lead_score: number;
  priority_tier: string;
  notes: string;
}

interface StrategyData {
  lead: LeadData;
  strategy: {
    recommended_entry_persona: string;
    primary_pain_hypotheses: string[];
    recommended_first_touch_angles: string[];
    risk_flags: string[];
  };
}

export default function LeadIntelligence() {
  const [input, setInput] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [prospectingLoading, setProspectingLoading] = useState(false);
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null);
  const { toast } = useToast();

  const analyzeLead = async () => {
    if (!input.trim()) {
      toast({ title: "Please enter lead information", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-intelligence", {
        body: { input: input.trim() }
      });

      if (error) throw error;

      if (data.success) {
        setLeadData(data.data);
        setStrategyData(null);
        toast({ title: "Lead analyzed successfully" });
      } else {
        throw new Error(data.error || "Failed to analyze lead");
      }
    } catch (error) {
      console.error("Error:", error);
      toast({ 
        title: "Analysis failed", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const generateStrategy = async () => {
    if (!leadData) {
      toast({ title: "Please analyze a lead first", variant: "destructive" });
      return;
    }

    setProspectingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("prospecting-assistant", {
        body: { 
          leadData,
          additionalNotes: additionalNotes.trim() || undefined
        }
      });

      if (error) throw error;

      if (data.success) {
        setStrategyData(data.data);
        toast({ title: "Strategy generated successfully" });
      } else {
        throw new Error(data.error || "Failed to generate strategy");
      }
    } catch (error) {
      console.error("Error:", error);
      toast({ 
        title: "Strategy generation failed", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setProspectingLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "A": return "bg-green-500";
      case "B": return "bg-yellow-500";
      case "C": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader />
      <OutboundNav />
      <div className="container mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Lead Intelligence Engine</h1>
        <p className="text-muted-foreground">
          Analyze arcade and FEC leads to extract structured data and generate prospecting strategies
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Step 1: Analyze Lead
          </CardTitle>
          <CardDescription>
            Enter company name, URL, notes, or any information about an arcade/FEC
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="e.g., Dave & Busters in San Francisco, https://daveandbusters.com, or paste any notes..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
          />
          <Button onClick={analyzeLead} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Analyze Lead
          </Button>
        </CardContent>
      </Card>

      {leadData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{leadData.company_name}</span>
                <Badge className={getTierColor(leadData.priority_tier)}>
                  Tier {leadData.priority_tier}
                </Badge>
              </CardTitle>
              <CardDescription>
                Score: {leadData.lead_score}/100 • {leadData.location}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Website</p>
                  <p className="text-sm text-muted-foreground">{leadData.website || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Estimated Games</p>
                  <p className="text-sm text-muted-foreground">{leadData.estimated_game_count || "Unknown"}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Features</p>
                <div className="flex gap-2">
                  {leadData.has_vr && <Badge variant="outline">VR</Badge>}
                  {leadData.has_redemption && <Badge variant="outline">Redemption</Badge>}
                  {leadData.has_bowling && <Badge variant="outline">Bowling</Badge>}
                  {!leadData.has_vr && !leadData.has_redemption && !leadData.has_bowling && (
                    <span className="text-sm text-muted-foreground">None detected</span>
                  )}
                </div>
              </div>

              {leadData.contacts && leadData.contacts.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Contacts</p>
                  <div className="space-y-2">
                    {leadData.contacts.map((contact, idx) => (
                      <div key={idx} className="text-sm border-l-2 border-primary pl-3">
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-muted-foreground">{contact.role}</p>
                        {contact.email && <p className="text-muted-foreground">{contact.email}</p>}
                        {contact.phone && <p className="text-muted-foreground">{contact.phone}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {leadData.notes && (
                <div>
                  <p className="text-sm font-medium mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{leadData.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Step 2: Generate Strategy
              </CardTitle>
              <CardDescription>
                Optional: Add additional notes or context before generating prospecting strategy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Additional observations, URLs, or context..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
              />
              <Button onClick={generateStrategy} disabled={prospectingLoading}>
                {prospectingLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Prospecting Strategy
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {strategyData && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Prospecting Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Recommended Entry Persona</p>
              <Badge variant="secondary" className="capitalize">
                {strategyData.strategy.recommended_entry_persona}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Primary Pain Hypotheses</p>
              <ul className="list-disc list-inside space-y-1">
                {strategyData.strategy.primary_pain_hypotheses.map((pain, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">{pain}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">First Touch Angles</p>
              <ul className="list-disc list-inside space-y-1">
                {strategyData.strategy.recommended_first_touch_angles.map((angle, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">{angle}</li>
                ))}
              </ul>
            </div>

            {strategyData.strategy.risk_flags && strategyData.strategy.risk_flags.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Risk Flags</p>
                <ul className="list-disc list-inside space-y-1">
                  {strategyData.strategy.risk_flags.map((flag, idx) => (
                    <li key={idx} className="text-sm text-destructive">{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
