import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, TrendingUp, Save, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { SharedHeader } from "@/components/SharedHeader";
import { OutboundNav } from "@/components/OutboundNav";
import { PredictedObjectionsSection } from "@/components/PredictedObjectionsSection";

interface Contact {
  name: string;
  role: string;
  email: string;
  phone: string;
}

interface LeadData {
  company_name: string;
  location: string;
  website: string;
  estimated_game_count: number;
  has_vr: boolean;
  has_redemption: boolean;
  has_bowling: boolean;
  contacts: Contact[];
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

interface Lead {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  lead_score: number | null;
  priority_tier: string | null;
  stage: string | null;
  last_contacted: string | null;
  company_id: string | null;
  momentum_score: number | null;
  momentum_trend: string | null;
  momentum_last_calculated: string | null;
  companies: {
    name: string;
    location: string | null;
    website: string | null;
    estimated_game_count: number | null;
    has_vr: boolean | null;
    has_redemption: boolean | null;
    has_bowling: boolean | null;
    notes: string | null;
  } | null;
}

interface Activity {
  id: string;
  activity_type: string | null;
  content: string | null;
  timestamp: string | null;
}

export default function OutboundLeads() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['outbound-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          companies (
            name,
            location,
            website,
            estimated_game_count,
            has_vr,
            has_redemption,
            has_bowling,
            notes
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Lead[];
    }
  });

  // Fetch activities for selected lead
  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', selectedLead?.id],
    queryFn: async () => {
      if (!selectedLead?.id) return [];
      
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', selectedLead.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data as Activity[];
    },
    enabled: !!selectedLead?.id
  });

  const generateLead = async () => {
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
        toast({ title: "Lead generated successfully" });
      } else {
        throw new Error(data.error || "Failed to generate lead");
      }
    } catch (error) {
      console.error("Error:", error);
      toast({ 
        title: "Generation failed", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const saveLeadToSupabase = async () => {
    if (!leadData) {
      toast({ title: "No lead data to save", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // First, check if company exists
      const { data: existingCompanies, error: searchError } = await supabase
        .from('companies')
        .select('id, notes')
        .eq('name', leadData.company_name)
        .limit(1);

      if (searchError) throw searchError;

      let companyId: string;

      if (existingCompanies && existingCompanies.length > 0) {
        // Company exists, update it
        companyId = existingCompanies[0].id;
        
        const existingNotes = existingCompanies[0].notes || "";
        const newNotes = leadData.notes ? `${existingNotes}\n${leadData.notes}`.trim() : existingNotes;

        const { error: updateError } = await supabase
          .from('companies')
          .update({
            location: leadData.location,
            website: leadData.website,
            estimated_game_count: leadData.estimated_game_count,
            has_vr: leadData.has_vr,
            has_redemption: leadData.has_redemption,
            has_bowling: leadData.has_bowling,
            notes: newNotes
          })
          .eq('id', companyId);

        if (updateError) throw updateError;
      } else {
        // Create new company
        const { data: newCompany, error: insertError } = await supabase
          .from('companies')
          .insert({
            name: leadData.company_name,
            location: leadData.location,
            website: leadData.website,
            estimated_game_count: leadData.estimated_game_count,
            has_vr: leadData.has_vr,
            has_redemption: leadData.has_redemption,
            has_bowling: leadData.has_bowling,
            notes: leadData.notes
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        companyId = newCompany.id;
      }

      // Create lead
      const contact = leadData.contacts?.[0];
      const { error: leadError } = await supabase
        .from('leads')
        .insert({
          company_id: companyId,
          name: contact?.name || leadData.company_name,
          role: contact?.role || null,
          email: contact?.email || null,
          phone: contact?.phone || null,
          lead_score: leadData.lead_score,
          priority_tier: leadData.priority_tier,
          stage: 'New',
          source: 'manual-intel',
          notes: leadData.notes
        });

      if (leadError) throw leadError;

      toast({ title: "Lead saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['outbound-leads'] });
      setLeadData(null);
      setInput("");
    } catch (error) {
      console.error("Error:", error);
      toast({ 
        title: "Failed to save lead", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const refineStrategy = async () => {
    if (!selectedLead) return;

    setStrategyLoading(true);
    try {
      const leadPayload: LeadData = {
        company_name: selectedLead.companies?.name || "",
        location: selectedLead.companies?.location || "",
        website: selectedLead.companies?.website || "",
        estimated_game_count: selectedLead.companies?.estimated_game_count || 0,
        has_vr: selectedLead.companies?.has_vr || false,
        has_redemption: selectedLead.companies?.has_redemption || false,
        has_bowling: selectedLead.companies?.has_bowling || false,
        contacts: [{
          name: selectedLead.name,
          role: selectedLead.role || "",
          email: selectedLead.email || "",
          phone: selectedLead.phone || ""
        }],
        lead_score: selectedLead.lead_score || 0,
        priority_tier: selectedLead.priority_tier || "C",
        notes: selectedLead.companies?.notes || ""
      };

      const { data, error } = await supabase.functions.invoke("prospecting-assistant", {
        body: { leadData: leadPayload }
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
      setStrategyLoading(false);
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

  const getMomentumTrendColor = (trend: string | null) => {
    switch (trend) {
      case "rising": return "bg-green-500/20 text-green-700 border-green-500/30";
      case "falling": return "bg-red-500/20 text-red-700 border-red-500/30";
      case "flat": return "bg-muted text-muted-foreground border-border";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const recalculateMomentum = async () => {
    if (!selectedLead?.id) return;
    
    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('recalculate-lead-momentum', {
        body: { lead_id: selectedLead.id }
      });

      if (error) throw error;

      // Update local state
      setSelectedLead(prev => prev ? {
        ...prev,
        momentum_score: data.momentum_score,
        momentum_trend: data.momentum_trend,
        momentum_last_calculated: new Date().toISOString()
      } : null);

      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ['outbound-leads'] });

      toast({
        title: "Momentum recalculated",
        description: `Score: ${data.momentum_score}, Trend: ${data.momentum_trend}`
      });
    } catch (error) {
      console.error('Momentum recalculation error:', error);
      toast({
        title: "Failed to recalculate momentum",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Lead Intelligence" showBackButton={true} backTo="/" />
      <OutboundNav />
      <div className="container mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Outbound – Leads</h1>
          <p className="text-muted-foreground">
            Generate and manage leads for arcade and FEC prospects
          </p>
        </div>

      {/* Lead Intake Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Lead Intake
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
          <Button onClick={generateLead} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Lead from Info
          </Button>
        </CardContent>
      </Card>

      {/* Lead Preview & Save */}
      {leadData && (
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

            <Button onClick={saveLeadToSupabase} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Lead to Supabase
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lead List View */}
      <Card>
        <CardHeader>
          <CardTitle>Lead List</CardTitle>
          <CardDescription>All leads from your outbound efforts</CardDescription>
        </CardHeader>
        <CardContent>
          {leadsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : leads.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No leads yet. Generate your first lead above!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Lead Score</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Momentum</TableHead>
                  <TableHead>Last Contacted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow 
                    key={lead.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.companies?.name || "N/A"}</TableCell>
                    <TableCell>{lead.lead_score || "—"}</TableCell>
                    <TableCell>
                      {lead.priority_tier && (
                        <Badge className={getTierColor(lead.priority_tier)}>
                          {lead.priority_tier}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{lead.stage || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lead.momentum_score ?? "—"}</span>
                        {lead.momentum_trend && (
                          <Badge variant="outline" className={getMomentumTrendColor(lead.momentum_trend)}>
                            {lead.momentum_trend}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.last_contacted 
                        ? new Date(lead.last_contacted).toLocaleDateString() 
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Lead Detail View */}
      {selectedLead && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Lead Details: {selectedLead.name}</span>
              <Button variant="outline" size="sm" onClick={() => setSelectedLead(null)}>
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">{selectedLead.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Role</p>
                  <p className="text-sm text-muted-foreground">{selectedLead.role || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{selectedLead.email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{selectedLead.phone || "N/A"}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Company Info */}
            {selectedLead.companies && (
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-3">Company Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Company Name</p>
                      <p className="text-sm text-muted-foreground">{selectedLead.companies.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">{selectedLead.companies.location || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <p className="text-sm text-muted-foreground">{selectedLead.companies.website || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Estimated Games</p>
                      <p className="text-sm text-muted-foreground">{selectedLead.companies.estimated_game_count || "Unknown"}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-2">Features</p>
                    <div className="flex gap-2">
                      {selectedLead.companies.has_vr && <Badge variant="outline">VR</Badge>}
                      {selectedLead.companies.has_redemption && <Badge variant="outline">Redemption</Badge>}
                      {selectedLead.companies.has_bowling && <Badge variant="outline">Bowling</Badge>}
                    </div>
                  </div>
                  {selectedLead.companies.notes && (
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-1">Notes</p>
                      <p className="text-sm text-muted-foreground">{selectedLead.companies.notes}</p>
                    </div>
                  )}
                </div>

                <Separator />
              </>
            )}

            {/* Lead Metrics */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Lead Metrics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium">Lead Score</p>
                  <p className="text-sm text-muted-foreground">{selectedLead.lead_score || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Priority Tier</p>
                  {selectedLead.priority_tier && (
                    <Badge className={getTierColor(selectedLead.priority_tier)}>
                      {selectedLead.priority_tier}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">Stage</p>
                  <p className="text-sm text-muted-foreground">{selectedLead.stage || "N/A"}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Momentum Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Momentum</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">
                      {selectedLead.momentum_score !== null ? selectedLead.momentum_score : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Score (0-100)</p>
                  </div>
                  {selectedLead.momentum_trend && (
                    <Badge variant="outline" className={getMomentumTrendColor(selectedLead.momentum_trend)}>
                      {selectedLead.momentum_trend}
                    </Badge>
                  )}
                </div>
                {selectedLead.momentum_last_calculated && (
                  <p className="text-xs text-muted-foreground">
                    Last calculated: {new Date(selectedLead.momentum_last_calculated).toLocaleString()}
                  </p>
                )}
                <Button 
                  onClick={recalculateMomentum} 
                  disabled={recalculating}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  {recalculating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Recalculate Momentum
                </Button>
              </CardContent>
            </Card>

            <Separator />

            {/* Activities */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Activities</h3>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <div key={activity.id} className="border-l-2 border-primary pl-3 py-2">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium">{activity.activity_type || "Activity"}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : ""}
                        </p>
                      </div>
                      {activity.content && (
                        <p className="text-sm text-muted-foreground mt-1">{activity.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Refine Strategy Button */}
            <Button onClick={refineStrategy} disabled={strategyLoading}>
              {strategyLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="mr-2 h-4 w-4" />
              )}
              Refine Prospecting Strategy
            </Button>

            {/* Strategy Results */}
            {strategyData && (
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Prospecting Strategy
                  </CardTitle>
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

            <Separator />

            {/* Predicted Objections Section */}
            <PredictedObjectionsSection lead={selectedLead} activities={activities} />
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
