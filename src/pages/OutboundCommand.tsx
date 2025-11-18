import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SharedHeader } from "@/components/SharedHeader";
import { OutboundNav } from "@/components/OutboundNav";
import { useNavigate } from "react-router-dom";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Trophy,
  XCircle,
  Calendar,
  Loader2,
  ExternalLink,
  Users,
  Download,
  CheckSquare,
} from "lucide-react";

interface Lead {
  id: string;
  name: string | null;
  company_id: string | null;
  stage: string | null;
  priority_tier: string | null;
  momentum_score: number | null;
  momentum_trend: string | null;
  last_contacted: string | null;
  companies: {
    name: string;
  } | null;
}

interface Activity {
  id: string;
  activity_type: string | null;
  content: string | null;
  timestamp: string | null;
  lead_id: string | null;
  leads: {
    name: string | null;
    companies: {
      name: string;
    } | null;
  } | null;
}

interface Objection {
  id: string;
  title: string;
  objection_text: string;
  severity_score: number | null;
  probability_score: number | null;
}

interface WinLoss {
  id: string;
  name: string | null;
  updated_at: string;
  companies: {
    name: string;
  } | null;
}

export default function OutboundCommand() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [recalculating, setRecalculating] = useState(false);

  // Fetch today's top targets
  const { data: topTargets = [], isLoading: targetsLoading } = useQuery({
    queryKey: ["command-top-targets"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("leads")
        .select("id, name, company_id, stage, priority_tier, momentum_score, momentum_trend, last_contacted, companies(name)")
        .not("stage", "in", '("Won","Lost")')
        .lte("last_contacted", today)
        .order("priority_tier", { ascending: true })
        .order("momentum_score", { ascending: false, nullsFirst: false })
        .order("last_contacted", { ascending: true, nullsFirst: false })
        .limit(10);

      if (error) throw error;
      return data as Lead[];
    },
  });

  // Fetch pipeline snapshot
  const { data: pipelineStats } = useQuery({
    queryKey: ["command-pipeline-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("stage")
        .not("stage", "in", '("Won","Lost")');

      if (error) throw error;

      const stageCounts: Record<string, number> = {};
      data.forEach((lead) => {
        const stage = lead.stage || "Unknown";
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      });

      return {
        total: data.length,
        byStage: stageCounts,
      };
    },
  });

  // Fetch momentum distribution
  const { data: momentumDist } = useQuery({
    queryKey: ["command-momentum-dist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("momentum_score, priority_tier")
        .not("stage", "in", '("Won","Lost")');

      if (error) throw error;

      const buckets = {
        "0-20": 0,
        "21-40": 0,
        "41-60": 0,
        "61-80": 0,
        "81-100": 0,
      };

      let highRiskCount = 0;

      data.forEach((lead) => {
        const score = lead.momentum_score || 0;
        if (score <= 20) buckets["0-20"]++;
        else if (score <= 40) buckets["21-40"]++;
        else if (score <= 60) buckets["41-60"]++;
        else if (score <= 80) buckets["61-80"]++;
        else buckets["81-100"]++;

        if (lead.priority_tier === "A" && score <= 40) {
          highRiskCount++;
        }
      });

      return { buckets, highRiskCount };
    },
  });

  // Fetch high-risk leads
  const { data: highRiskLeads = [] } = useQuery({
    queryKey: ["command-high-risk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, company_id, stage, momentum_score, momentum_trend, companies(name)")
        .eq("priority_tier", "A")
        .lte("momentum_score", 40)
        .not("stage", "in", '("Won","Lost")')
        .order("momentum_score", { ascending: true, nullsFirst: false })
        .limit(10);

      if (error) throw error;
      return data as Lead[];
    },
  });

  // Fetch objections
  const { data: topObjections = [] } = useQuery({
    queryKey: ["command-objections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("objections")
        .select("id, title, objection_text, severity_score, probability_score")
        .order("severity_score", { ascending: false, nullsFirst: false })
        .limit(5);

      if (error) throw error;
      return data as Objection[];
    },
  });

  // Fetch upcoming demos
  const { data: upcomingDemos = [] } = useQuery({
    queryKey: ["command-demos"],
    queryFn: async () => {
      const today = new Date().toISOString();

      const { data, error } = await supabase
        .from("activities")
        .select("id, activity_type, content, timestamp, lead_id, leads(name, companies(name))")
        .eq("activity_type", "demo_plan")
        .gte("timestamp", today)
        .order("timestamp", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data as Activity[];
    },
  });

  // Fetch recent wins/losses
  const { data: recentWins = [] } = useQuery({
    queryKey: ["command-wins"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("leads")
        .select("id, name, updated_at, companies(name)")
        .eq("stage", "Won")
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as WinLoss[];
    },
  });

  const { data: recentLosses = [] } = useQuery({
    queryKey: ["command-losses"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("leads")
        .select("id, name, updated_at, companies(name)")
        .eq("stage", "Lost")
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as WinLoss[];
    },
  });

  // Recalculate all momentum
  const recalculateAllMomentum = async () => {
    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("recalculate-lead-momentum", {
        body: {},
      });

      if (error) throw error;

      toast.success(`Momentum updated for ${data.updated_count || 0} leads`);
      queryClient.invalidateQueries({ queryKey: ["command-momentum-dist"] });
      queryClient.invalidateQueries({ queryKey: ["command-high-risk"] });
      queryClient.invalidateQueries({ queryKey: ["command-top-targets"] });
    } catch (error: any) {
      toast.error(`Failed to recalculate: ${error.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const getMomentumTrendColor = (trend: string | null) => {
    if (trend === "rising") return "text-green-600";
    if (trend === "falling") return "text-red-600";
    return "text-muted-foreground";
  };

  const getMomentumIcon = (trend: string | null) => {
    if (trend === "rising") return TrendingUp;
    if (trend === "falling") return TrendingDown;
    return Minus;
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader />
      <OutboundNav />

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero - Today's Top Targets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Today's Top Targets
            </CardTitle>
            <CardDescription>High-priority leads requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {targetsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : topTargets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No actions due today.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topTargets.map((lead) => {
                  const MomentumIcon = getMomentumIcon(lead.momentum_trend);
                  return (
                    <Card key={lead.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="font-semibold">{lead.name || lead.companies?.name || "Unknown"}</div>
                        <div className="text-sm text-muted-foreground">{lead.companies?.name}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{lead.stage || "Unknown"}</Badge>
                          <Badge variant={lead.priority_tier === "A" ? "default" : "secondary"}>
                            {lead.priority_tier || "C"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Momentum:</span>
                          <span>{lead.momentum_score || "—"}</span>
                          <MomentumIcon className={`h-4 w-4 ${getMomentumTrendColor(lead.momentum_trend)}`} />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="default" onClick={() => navigate(`/outbound-leads`)}>
                            View Lead
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/outbound-tasks`)}>
                            Open Task
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Command Board Panels - 2x3 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Panel 1 - Pipeline Snapshot */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-bold">{pipelineStats?.total || 0}</div>
                <div className="text-sm text-muted-foreground">Active Leads</div>
              </div>
              <div className="space-y-2">
                {pipelineStats?.byStage &&
                  Object.entries(pipelineStats.byStage).map(([stage, count]) => (
                    <div key={stage} className="flex justify-between text-sm">
                      <span>{stage}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/outbound-pipeline")}>
                Open Pipeline Analytics
              </Button>
            </CardContent>
          </Card>

          {/* Panel 2 - Momentum Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Momentum Heatmap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {momentumDist?.buckets &&
                  Object.entries(momentumDist.buckets).map(([bucket, count]) => (
                    <div key={bucket} className="flex justify-between text-sm">
                      <span>{bucket}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
              {momentumDist && momentumDist.highRiskCount > 0 && (
                <div className="p-2 bg-destructive/10 rounded text-sm text-destructive font-medium">
                  ⚠️ {momentumDist.highRiskCount} high-tier leads at low momentum
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={recalculateAllMomentum}
                disabled={recalculating}
              >
                {recalculating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Recalculate All Momentum
              </Button>
            </CardContent>
          </Card>

          {/* Panel 3 - High-Risk Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                High-Risk Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {highRiskLeads.length === 0 ? (
                <div className="text-sm text-muted-foreground">No high-risk leads</div>
              ) : (
                <div className="space-y-2">
                  {highRiskLeads.map((lead) => {
                    const MomentumIcon = getMomentumIcon(lead.momentum_trend);
                    return (
                      <div key={lead.id} className="flex items-center justify-between text-sm border-b pb-2">
                        <div>
                          <div className="font-medium">{lead.name || lead.companies?.name}</div>
                          <div className="text-xs text-muted-foreground">{lead.stage}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{lead.momentum_score}</span>
                          <MomentumIcon className={`h-3 w-3 ${getMomentumTrendColor(lead.momentum_trend)}`} />
                          <Button size="sm" variant="ghost" onClick={() => navigate("/outbound-leads")}>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Panel 4 - Predicted Objection Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Objection Killers</CardTitle>
            </CardHeader>
            <CardContent>
              {topObjections.length === 0 ? (
                <div className="text-sm text-muted-foreground">No objections logged</div>
              ) : (
                <div className="space-y-2">
                  {topObjections.map((obj) => (
                    <div key={obj.id} className="text-sm border-b pb-2">
                      <div className="font-medium truncate">{obj.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{obj.objection_text.slice(0, 50)}...</div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Sev: {obj.severity_score || "—"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Prob: {obj.probability_score || "—"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" className="w-full mt-4" onClick={() => navigate("/outbound-objections")}>
                Open Objection Analytics
              </Button>
            </CardContent>
          </Card>

          {/* Panel 5 - Upcoming Demos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Upcoming Demos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingDemos.length === 0 ? (
                <div className="text-sm text-muted-foreground">No demos scheduled</div>
              ) : (
                <div className="space-y-2">
                  {upcomingDemos.map((demo) => (
                    <div key={demo.id} className="text-sm border-b pb-2">
                      <div className="font-medium">{demo.leads?.name || demo.leads?.companies?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {demo.timestamp ? new Date(demo.timestamp).toLocaleDateString() : "—"}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1"
                        onClick={() => navigate("/outbound-demo")}
                      >
                        Open Demo
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Panel 6 - Recent Wins + Losses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Wins + Losses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium flex items-center gap-1 mb-2">
                  <Trophy className="h-4 w-4 text-green-600" />
                  Wins (30d)
                </div>
                {recentWins.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No recent wins</div>
                ) : (
                  <div className="space-y-1">
                    {recentWins.map((lead) => (
                      <div key={lead.id} className="text-xs">
                        {lead.name || lead.companies?.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm font-medium flex items-center gap-1 mb-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Losses (30d)
                </div>
                {recentLosses.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No recent losses</div>
                ) : (
                  <div className="space-y-1">
                    {recentLosses.map((lead) => (
                      <div key={lead.id} className="text-xs">
                        {lead.name || lead.companies?.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/outbound-pipeline")}>
                View Pipeline
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Action Bar - Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 shadow-lg">
        <div className="container mx-auto flex flex-wrap justify-center gap-4">
          <Button variant="default" onClick={() => navigate("/outbound-leads")}>
            <Users className="mr-2 h-4 w-4" />
            New Lead Intake
          </Button>
          <Button variant="default" onClick={() => navigate("/outbound-import")}>
            <Download className="mr-2 h-4 w-4" />
            Run Google Import
          </Button>
          <Button variant="default" onClick={() => navigate("/outbound-tasks")}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Task Queue
          </Button>
        </div>
      </div>
    </div>
  );
}
