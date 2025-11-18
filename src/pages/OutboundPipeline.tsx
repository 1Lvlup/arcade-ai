import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SharedHeader } from "@/components/SharedHeader";
import { OutboundNav } from "@/components/OutboundNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Lead {
  id: string;
  name: string;
  stage: string | null;
  priority_tier: string | null;
  last_contacted: string | null;
  momentum_score: number | null;
  momentum_trend: string | null;
  company_id: string | null;
  companies: {
    name: string;
  } | null;
}

export default function OutboundPipeline() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [recalculating, setRecalculating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch all active leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['outbound-pipeline-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          companies (
            name
          )
        `)
        .not('stage', 'in', '("Won","Lost")');

      if (error) throw error;
      return data as Lead[];
    }
  });

  // Calculate momentum distribution buckets
  const getMomentumDistribution = () => {
    const buckets = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '21-40', min: 21, max: 40, count: 0 },
      { range: '41-60', min: 41, max: 60, count: 0 },
      { range: '61-80', min: 61, max: 80, count: 0 },
      { range: '81-100', min: 81, max: 100, count: 0 },
    ];

    leads.forEach(lead => {
      if (lead.momentum_score !== null) {
        const bucket = buckets.find(b => 
          lead.momentum_score! >= b.min && lead.momentum_score! <= b.max
        );
        if (bucket) bucket.count++;
      }
    });

    return buckets;
  };

  // Calculate average momentum per stage
  const getAvgMomentumPerStage = () => {
    const stages = ['New', 'Researching', 'Contacted', 'Discovery', 'Demo', 'Eval'];
    
    return stages.map(stage => {
      const stageLeads = leads.filter(l => l.stage === stage);
      const leadsWithMomentum = stageLeads.filter(l => l.momentum_score !== null);
      
      const avgMomentum = leadsWithMomentum.length > 0
        ? Math.round(leadsWithMomentum.reduce((sum, l) => sum + (l.momentum_score || 0), 0) / leadsWithMomentum.length)
        : 0;

      return {
        stage,
        avgMomentum,
        count: stageLeads.length
      };
    }).filter(s => s.count > 0);
  };

  // Get high-risk low-momentum leads
  const getHighRiskLeads = () => {
    return leads.filter(lead =>
      lead.priority_tier === 'A' &&
      lead.momentum_score !== null &&
      lead.momentum_score <= 40
    );
  };

  // Recalculate all momentum
  const recalculateAllMomentum = async () => {
    setRecalculating(true);
    setShowConfirm(false);

    try {
      const { data, error } = await supabase.functions.invoke('recalculate-lead-momentum', {
        body: {}
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['outbound-pipeline-leads'] });
      
      toast.success(`Momentum updated for ${data.processed_leads} leads`);
    } catch (error) {
      console.error('Bulk momentum recalculation error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to recalculate momentum");
    } finally {
      setRecalculating(false);
    }
  };

  const getTierColor = (tier: string | null) => {
    switch (tier) {
      case "A": return "bg-green-500";
      case "B": return "bg-yellow-500";
      case "C": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const momentumDistribution = getMomentumDistribution();
  const avgMomentumPerStage = getAvgMomentumPerStage();
  const highRiskLeads = getHighRiskLeads();

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Outbound Pipeline" showBackButton={true} backTo="/" />
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Outbound – Pipeline Analytics</h1>
            <p className="text-muted-foreground">
              Momentum insights and risk analysis
            </p>
          </div>
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={recalculating}
            variant="outline"
          >
            {recalculating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Recalculate All Momentum
          </Button>
        </div>

        <OutboundNav />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin" />
          </div>
        ) : (
          <>
            {/* SECTION 5: Momentum Distribution & Risk Bands */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Momentum Distribution & Risk Bands
                </CardTitle>
                <CardDescription>
                  Analyze lead momentum across the pipeline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* A) Momentum Distribution */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Momentum Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={momentumDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="hsl(var(--primary))" name="Number of Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* B) Momentum vs Stage */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Average Momentum by Stage</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={avgMomentumPerStage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stage" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="avgMomentum" fill="hsl(var(--accent))" name="Avg Momentum Score" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* C) High-Risk Low-Momentum Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    High-Risk Low-Momentum Leads
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      (A-tier leads with momentum ≤ 40)
                    </span>
                  </h3>
                  {highRiskLeads.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No high-risk low-momentum leads. Great job! 🎉
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead Name</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead>Momentum Score</TableHead>
                          <TableHead>Last Contacted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {highRiskLeads.map((lead) => (
                          <TableRow 
                            key={lead.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate('/lead-intelligence')}
                          >
                            <TableCell className="font-medium">{lead.name}</TableCell>
                            <TableCell>{lead.companies?.name || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{lead.stage || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-bold text-red-600">
                                {lead.momentum_score}
                              </span>
                            </TableCell>
                            <TableCell>
                              {lead.last_contacted
                                ? format(new Date(lead.last_contacted), 'MMM d, yyyy')
                                : 'Never'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Recalculate Momentum for All Active Leads?</AlertDialogTitle>
              <AlertDialogDescription>
                This will recalculate momentum scores for all leads not in "Won" or "Lost" stages. 
                This may take a moment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={recalculateAllMomentum}>
                Recalculate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
