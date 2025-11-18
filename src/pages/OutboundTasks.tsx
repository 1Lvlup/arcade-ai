import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SharedHeader } from "@/components/SharedHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Loader2, Calendar, Filter, FileText } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

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
  companies: {
    name: string;
    location: string | null;
    website: string | null;
    estimated_game_count: number | null;
    has_vr: boolean | null;
    has_redemption: boolean | null;
    has_bowling: boolean | null;
  } | null;
}

interface Activity {
  id: string;
  activity_type: string | null;
  content: string | null;
  timestamp: string | null;
}

export default function OutboundTasks() {
  const queryClient = useQueryClient();
  
  // Filters
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [selectedDate] = useState(new Date());

  // Action drawer
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>("email");
  const [selectedPhase, setSelectedPhase] = useState<string>("prospecting");
  const [activityContent, setActivityContent] = useState("");
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [newStage, setNewStage] = useState<string>("");
  
  // Discovery section state
  const [discoveryNotes, setDiscoveryNotes] = useState("");
  const [isGeneratingDiscovery, setIsGeneratingDiscovery] = useState(false);
  const [discoverySummary, setDiscoverySummary] = useState<any>(null);

  // Fetch leads with filters
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['outbound-tasks', priorityFilter, stageFilter],
    queryFn: async () => {
      let query = supabase
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
            has_bowling
          )
        `);

      if (priorityFilter !== "All") {
        query = query.eq('priority_tier', priorityFilter);
      }

      if (stageFilter !== "All") {
        query = query.eq('stage', stageFilter);
      }

      const { data, error } = await query.order('priority_tier', { ascending: true });

      if (error) throw error;

      // Sort by priority, then score, then last_contacted
      const sorted = (data as Lead[]).sort((a, b) => {
        // Priority tier order: A < B < C
        const tierOrder: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3 };
        const aTier = tierOrder[a.priority_tier || 'C'] || 999;
        const bTier = tierOrder[b.priority_tier || 'C'] || 999;
        if (aTier !== bTier) return aTier - bTier;

        // Then by lead_score descending
        const aScore = a.lead_score || 0;
        const bScore = b.lead_score || 0;
        if (aScore !== bScore) return bScore - aScore;

        // Then by last_contacted ascending (oldest first)
        const aDate = a.last_contacted ? new Date(a.last_contacted).getTime() : 0;
        const bDate = b.last_contacted ? new Date(b.last_contacted).getTime() : 0;
        return aDate - bDate;
      });

      return sorted;
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
        .order('timestamp', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Activity[];
    },
    enabled: !!selectedLead?.id
  });

  // Get suggested action based on stage and last_contacted
  const getSuggestedAction = (lead: Lead): string => {
    if (lead.stage === 'New') return "First outreach";
    if (lead.stage === 'Contacted' && daysSinceContact(lead) > 3) return "Follow-up";
    if (lead.stage === 'Discovery' && daysSinceContact(lead) > 5) return "Advance / book demo";
    if (lead.stage === 'Demo' && daysSinceContact(lead) > 3) return "Post-demo follow-up";
    return "Check in";
  };

  const daysSinceContact = (lead: Lead): number => {
    if (!lead.last_contacted) return 999;
    const days = Math.floor((Date.now() - new Date(lead.last_contacted).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  // Get stage summary
  const getStageSummary = () => {
    const stages = ['New', 'Contacted', 'Discovery', 'Demo', 'Eval', 'Won', 'Lost'];
    return stages.map(stage => ({
      stage,
      count: leads.filter(l => l.stage === stage).length
    }));
  };

  // Infer persona from role
  const inferPersona = (role: string | null): string => {
    if (!role) return "gm";
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes("tech") || lowerRole.includes("maintenance")) return "tech";
    if (lowerRole.includes("manager") || lowerRole.includes("gm")) return "gm";
    if (lowerRole.includes("owner") || lowerRole.includes("ceo")) return "owner";
    return "gm";
  };

  // Infer script type from channel
  const inferScriptType = (channel: string, stage: string | null): string => {
    if (channel === "call") {
      return stage === "New" ? "cold_call_opening" : "follow_up_call";
    }
    if (channel === "email") return "follow_up_email";
    if (channel === "sms") return "sms_check_in";
    if (channel === "note") return "internal_note";
    return "follow_up_email";
  };

  // Generate script
  const handleGenerateScript = async () => {
    if (!selectedLead) return;

    setIsGeneratingScript(true);
    setGeneratedScript(null);

    try {
      const persona = inferPersona(selectedLead.role);
      const scriptType = inferScriptType(selectedChannel, selectedLead.stage);
      const suggestedAction = getSuggestedAction(selectedLead);

      const contextSummary = `
Stage: ${selectedLead.stage || 'Unknown'}
Suggested Action: ${suggestedAction}
Recent Activities: ${activities.slice(0, 3).map(a => `${a.activity_type}: ${a.content}`).join('; ')}
Company: ${selectedLead.companies?.name || 'Unknown'}
      `.trim();

      const { data, error } = await supabase.functions.invoke("script-library-engine", {
        body: {
          persona,
          phase: selectedPhase,
          script_type: scriptType,
          context: contextSummary,
        },
      });

      if (error) throw error;

      let parsedData: any;
      if (typeof data === "string") {
        parsedData = JSON.parse(data);
      } else {
        parsedData = data;
      }

      setGeneratedScript(parsedData.content || "No script content returned");
      toast.success("Script generated successfully");
    } catch (error: any) {
      console.error("Error generating script:", error);
      toast.error(error.message || "Failed to generate script");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Log activity mutation
  const logActivityMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLead || !activityContent.trim()) {
        throw new Error("Missing lead or activity content");
      }

      // Insert activity
      const { error: activityError } = await supabase
        .from('activities')
        .insert({
          lead_id: selectedLead.id,
          company_id: selectedLead.company_id,
          activity_type: selectedChannel,
          content: activityContent,
          timestamp: new Date().toISOString()
        });

      if (activityError) throw activityError;

      // Update last_contacted
      const { error: leadError } = await supabase
        .from('leads')
        .update({ last_contacted: new Date().toISOString() })
        .eq('id', selectedLead.id);

      if (leadError) throw leadError;
    },
    onSuccess: () => {
      toast.success("Activity logged successfully");
      setActivityContent("");
      queryClient.invalidateQueries({ queryKey: ['lead-activities', selectedLead?.id] });
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to log activity");
    }
  });

  // Update stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async (stage: string) => {
      if (!selectedLead) throw new Error("No lead selected");

      const { error } = await supabase
        .from('leads')
        .update({ stage })
        .eq('id', selectedLead.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stage updated successfully");
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks'] });
      if (selectedLead) {
        setSelectedLead({ ...selectedLead, stage: newStage });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update stage");
    }
  });

  // Generate discovery summary
  const handleGenerateDiscovery = async () => {
    if (!selectedLead || !discoveryNotes.trim()) {
      toast.error("Please enter discovery notes");
      return;
    }

    setIsGeneratingDiscovery(true);
    try {
      const { data, error } = await supabase.functions.invoke("discovery-engine", {
        body: {
          lead: selectedLead,
          notes: discoveryNotes,
        },
      });

      if (error) throw error;

      let parsedData: any;
      if (typeof data === "string") {
        parsedData = JSON.parse(data);
      } else {
        parsedData = data;
      }

      setDiscoverySummary(parsedData);
      toast.success("Discovery summary generated successfully");
    } catch (error: any) {
      console.error("Error generating discovery summary:", error);
      toast.error(error.message || "Failed to generate discovery summary");
    } finally {
      setIsGeneratingDiscovery(false);
    }
  };

  // Save discovery summary
  const saveDiscoveryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLead || !discoverySummary) {
        throw new Error("Missing lead or summary");
      }

      const { error } = await supabase
        .from('activities')
        .insert({
          lead_id: selectedLead.id,
          company_id: selectedLead.company_id,
          activity_type: 'discovery_summary',
          content: JSON.stringify(discoverySummary),
          timestamp: new Date().toISOString()
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Discovery summary saved");
      setDiscoveryNotes("");
      setDiscoverySummary(null);
      queryClient.invalidateQueries({ queryKey: ['lead-activities', selectedLead?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save summary");
    }
  });

  const handleOpenAction = (lead: Lead) => {
    setSelectedLead(lead);
    setNewStage(lead.stage || "New");
    setDrawerOpen(true);
    setGeneratedScript(null);
    setActivityContent("");
    setDiscoveryNotes("");
    setDiscoverySummary(null);
  };

  const getPriorityColor = (tier: string | null) => {
    switch (tier) {
      case "A": return "bg-green-500";
      case "B": return "bg-yellow-500";
      case "C": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Outbound - Tasks" showBackButton={true} backTo="/" />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Outbound – Tasks</h1>
          <p className="text-muted-foreground">Today's prioritized actions for your outbound pipeline</p>
        </div>

        {/* SECTION 1: Filters + Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Priority Tier</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Stage</Label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Researching">Researching</SelectItem>
                    <SelectItem value="Contacted">Contacted</SelectItem>
                    <SelectItem value="Discovery">Discovery</SelectItem>
                    <SelectItem value="Demo">Demo</SelectItem>
                    <SelectItem value="Eval">Eval</SelectItem>
                    <SelectItem value="Won">Won</SelectItem>
                    <SelectItem value="Lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date
                </Label>
                <div className="p-2 border rounded-md bg-muted">
                  {format(selectedDate, 'MMMM d, yyyy')}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="pt-4 border-t">
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Total Leads: </span>
                  <span className="font-bold">{leads.length}</span>
                </div>
                {getStageSummary().map(({ stage, count }) => (
                  count > 0 && (
                    <div key={stage}>
                      <span className="text-sm text-muted-foreground">{stage}: </span>
                      <span className="font-bold">{count}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: Today's Actions List */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Actions</CardTitle>
            <CardDescription>Prioritized by tier, score, and last contact</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : leads.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No leads match your filters</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Suggested Action</TableHead>
                    <TableHead>Last Contacted</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.companies?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(lead.priority_tier)}>
                          {lead.priority_tier || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.stage || 'N/A'}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {getSuggestedAction(lead)}
                      </TableCell>
                      <TableCell>
                        {lead.last_contacted
                          ? format(new Date(lead.last_contacted), 'MMM d, yyyy')
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleOpenAction(lead)}>
                          Open Action
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* SECTION 3: Action Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Action for {selectedLead?.name}</SheetTitle>
              <SheetDescription>
                {selectedLead?.companies?.name} • {selectedLead?.stage}
              </SheetDescription>
            </SheetHeader>

            {selectedLead && (
              <Tabs defaultValue="action" className="mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="action">Action</TabsTrigger>
                  <TabsTrigger value="discovery">Discovery</TabsTrigger>
                </TabsList>

                <TabsContent value="action" className="space-y-6 mt-6">
                {/* Lead Info */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Lead Information</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Role:</span> {selectedLead.role || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedLead.email || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {selectedLead.phone || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Score:</span> {selectedLead.lead_score || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Priority:</span> {selectedLead.priority_tier || 'N/A'}</p>
                  </div>
                </div>

                {/* Company Info */}
                {selectedLead.companies && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Company Information</h3>
                    <div className="text-sm space-y-1">
                      <p><span className="text-muted-foreground">Location:</span> {selectedLead.companies.location || 'N/A'}</p>
                      <p><span className="text-muted-foreground">Website:</span> {selectedLead.companies.website || 'N/A'}</p>
                      <p><span className="text-muted-foreground">Est. Games:</span> {selectedLead.companies.estimated_game_count || 'N/A'}</p>
                      <p><span className="text-muted-foreground">Has VR:</span> {selectedLead.companies.has_vr ? 'Yes' : 'No'}</p>
                      <p><span className="text-muted-foreground">Has Redemption:</span> {selectedLead.companies.has_redemption ? 'Yes' : 'No'}</p>
                      <p><span className="text-muted-foreground">Has Bowling:</span> {selectedLead.companies.has_bowling ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                )}

                {/* Recent Activities */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Recent Activities</h3>
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activities yet</p>
                  ) : (
                    <div className="space-y-2">
                      {activities.map((activity) => (
                        <div key={activity.id} className="text-sm p-2 border rounded">
                          <p className="font-medium">{activity.activity_type}</p>
                          <p className="text-muted-foreground text-xs">
                            {activity.timestamp ? format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a') : ''}
                          </p>
                          <p className="mt-1">{activity.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Update Stage */}
                <div className="space-y-2">
                  <Label>Update Stage</Label>
                  <div className="flex gap-2">
                    <Select value={newStage} onValueChange={setNewStage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Researching">Researching</SelectItem>
                        <SelectItem value="Contacted">Contacted</SelectItem>
                        <SelectItem value="Discovery">Discovery</SelectItem>
                        <SelectItem value="Demo">Demo</SelectItem>
                        <SelectItem value="Eval">Eval</SelectItem>
                        <SelectItem value="Won">Won</SelectItem>
                        <SelectItem value="Lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => updateStageMutation.mutate(newStage)}
                      disabled={updateStageMutation.isPending || newStage === selectedLead.stage}
                    >
                      {updateStageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                    </Button>
                  </div>
                </div>

                {/* Script Generator */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Generate Script</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Channel</Label>
                      <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">Call</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="note">Note</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Phase</Label>
                      <Select value={selectedPhase} onValueChange={setSelectedPhase}>
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

                  <Button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="w-full"
                  >
                    {isGeneratingScript ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      "Suggest Script"
                    )}
                  </Button>

                  {generatedScript && (
                    <div className="space-y-2 mt-4">
                      <Label>Generated Script</Label>
                      <Textarea
                        value={generatedScript}
                        readOnly
                        rows={10}
                        className="font-mono text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Log Activity */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Log Activity</h3>
                  <div className="space-y-2">
                    <Label>Activity Content</Label>
                    <Textarea
                      value={activityContent}
                      onChange={(e) => setActivityContent(e.target.value)}
                      placeholder="Describe what happened in this interaction..."
                      rows={4}
                    />
                    <Button
                      onClick={() => logActivityMutation.mutate()}
                      disabled={logActivityMutation.isPending || !activityContent.trim()}
                      className="w-full"
                    >
                      {logActivityMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        "Save Activity"
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="discovery" className="space-y-6 mt-6">
                {/* Discovery Notes Input */}
                <div className="space-y-2">
                  <Label>Paste Discovery Call Notes</Label>
                  <Textarea
                    value={discoveryNotes}
                    onChange={(e) => setDiscoveryNotes(e.target.value)}
                    placeholder="Paste raw notes from your discovery call here..."
                    className="min-h-[150px]"
                  />
                  <Button
                    onClick={handleGenerateDiscovery}
                    disabled={isGeneratingDiscovery || !discoveryNotes.trim()}
                    className="w-full"
                  >
                    {isGeneratingDiscovery && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Discovery Summary
                  </Button>
                </div>

                {/* Discovery Summary Display */}
                {discoverySummary && (
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Discovery Summary
                      </h3>
                      <Button
                        size="sm"
                        onClick={() => saveDiscoveryMutation.mutate()}
                        disabled={saveDiscoveryMutation.isPending}
                      >
                        {saveDiscoveryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Summary
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm mb-1">Company</h4>
                        <p className="text-sm text-muted-foreground">{discoverySummary.company || 'N/A'}</p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-1">Contact</h4>
                        <p className="text-sm text-muted-foreground">{discoverySummary.contact || 'N/A'}</p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-1">Pain Points</h4>
                        {discoverySummary.pain_points?.length > 0 ? (
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {discoverySummary.pain_points.map((point: string, idx: number) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">None identified</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-1">Game Issues</h4>
                        {discoverySummary.game_issues?.length > 0 ? (
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {discoverySummary.game_issues.map((issue: string, idx: number) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">None identified</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-1">Decision Process</h4>
                        <p className="text-sm text-muted-foreground">{discoverySummary.decision_process || 'N/A'}</p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-1">Budget Signals</h4>
                        <p className="text-sm text-muted-foreground">{discoverySummary.budget_signals || 'N/A'}</p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-1">Risk Factors</h4>
                        {discoverySummary.risk_factors?.length > 0 ? (
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {discoverySummary.risk_factors.map((risk: string, idx: number) => (
                              <li key={idx}>{risk}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">None identified</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-1">Next Steps</h4>
                        {discoverySummary.next_steps?.length > 0 ? (
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {discoverySummary.next_steps.map((step: string, idx: number) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">None identified</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Historical Discovery Summaries */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Historical Discovery Summaries</h3>
                  {activities?.filter(a => a.activity_type === 'discovery_summary').length > 0 ? (
                    <div className="space-y-3">
                      {activities
                        .filter(a => a.activity_type === 'discovery_summary')
                        .map((activity) => {
                          let summary;
                          try {
                            summary = JSON.parse(activity.content || '{}');
                          } catch {
                            summary = {};
                          }
                          return (
                            <div key={activity.id} className="border rounded-lg p-3 bg-muted/30">
                              <p className="text-xs text-muted-foreground mb-2">
                                {activity.timestamp ? format(new Date(activity.timestamp), 'PPp') : 'N/A'}
                              </p>
                              <div className="space-y-2 text-sm">
                                <p><strong>Company:</strong> {summary.company || 'N/A'}</p>
                                <p><strong>Contact:</strong> {summary.contact || 'N/A'}</p>
                                {summary.pain_points?.length > 0 && (
                                  <div>
                                    <strong>Pain Points:</strong>
                                    <ul className="list-disc list-inside ml-2">
                                      {summary.pain_points.map((p: string, i: number) => <li key={i}>{p}</li>)}
                                    </ul>
                                  </div>
                                )}
                                {summary.next_steps?.length > 0 && (
                                  <div>
                                    <strong>Next Steps:</strong>
                                    <ul className="list-disc list-inside ml-2">
                                      {summary.next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No discovery summaries yet</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
