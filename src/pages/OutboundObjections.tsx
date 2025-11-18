import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SharedHeader } from "@/components/SharedHeader";
import { OutboundNav } from "@/components/OutboundNav";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Objection {
  id: string;
  title: string;
  objection_text: string;
  persona: string | null;
  stage: string | null;
  cluster: string | null;
  severity_score: number | null;
  probability_score: number | null;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

export default function OutboundObjections() {
  // Fetch all objections
  const { data: objections = [], isLoading } = useQuery({
    queryKey: ['objections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Objection[];
    }
  });

  // Calculate stats
  const totalObjections = objections.length;
  const byPersona = objections.reduce((acc, obj) => {
    const persona = obj.persona || 'Unknown';
    acc[persona] = (acc[persona] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byStage = objections.reduce((acc, obj) => {
    const stage = obj.stage || 'Unknown';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byCluster = objections.reduce((acc, obj) => {
    const cluster = obj.cluster || 'Unknown';
    acc[cluster] = (acc[cluster] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const bySeverity = {
    'Low (1-3)': objections.filter(o => o.severity_score && o.severity_score <= 3).length,
    'Medium (4-6)': objections.filter(o => o.severity_score && o.severity_score >= 4 && o.severity_score <= 6).length,
    'High (7-10)': objections.filter(o => o.severity_score && o.severity_score >= 7).length,
  };

  // Chart data
  const personaData = Object.entries(byPersona).map(([name, value]) => ({ name, value }));
  const stageData = Object.entries(byStage).map(([name, value]) => ({ name, value }));
  const clusterData = Object.entries(byCluster).map(([name, value]) => ({ name, value }));
  const severityData = Object.entries(bySeverity).map(([name, value]) => ({ name, value }));

  // Scatter data for severity vs probability
  const scatterData = objections
    .filter(o => o.severity_score && o.probability_score)
    .map(o => ({
      x: o.probability_score || 0,
      y: o.severity_score || 0,
      cluster: o.cluster || 'Unknown',
      title: o.title
    }));

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SharedHeader />
        <OutboundNav />
        <div className="flex-1 flex items-center justify-center">
          <p>Loading objections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SharedHeader />
      <OutboundNav />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Objection Analytics</h1>
          <p className="text-muted-foreground">Analyze patterns, trends, and outcomes</p>
        </div>

        {/* SECTION 1 - Frequency Dashboard */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Objection Frequency Dashboard</CardTitle>
            <CardDescription>Total objections stored and breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Objections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalObjections}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Low Severity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{bySeverity['Low (1-3)']}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Medium Severity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{bySeverity['Medium (4-6)']}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">High Severity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{bySeverity['High (7-10)']}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold mb-4">By Persona</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={personaData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">By Cluster</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={clusterData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {clusterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">By Stage</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">By Severity Bucket</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2 - Severity vs Probability Matrix */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Severity vs. Probability Matrix</CardTitle>
            <CardDescription>
              Scatter plot showing risk zones. High-risk zone: probability ≥ 60% AND severity ≥ 7
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Probability (%)" 
                  domain={[0, 100]}
                  label={{ value: 'Probability (%)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Severity" 
                  domain={[0, 10]}
                  label={{ value: 'Severity (1-10)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border border-border p-2 rounded shadow-lg">
                          <p className="font-semibold">{data.title}</p>
                          <p>Probability: {data.x}%</p>
                          <p>Severity: {data.y}/10</p>
                          <p>Cluster: {data.cluster}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                {Object.keys(byCluster).map((cluster, idx) => (
                  <Scatter
                    key={cluster}
                    name={cluster}
                    data={scatterData.filter(d => d.cluster === cluster)}
                    fill={COLORS[idx % COLORS.length]}
                  />
                ))}
                {/* High-risk zone indicator */}
                <rect x="60%" y="0" width="40%" height="30%" fill="rgba(255, 0, 0, 0.1)" />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500/20 border border-red-500"></div>
                <span className="text-sm">High-Risk Zone (P≥60%, S≥7)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3 - Objection Outcome Correlation */}
        <Card>
          <CardHeader>
            <CardTitle>Top Objections by Stage</CardTitle>
            <CardDescription>Which objections appear most frequently at each stage</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Objection</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Probability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objections.slice(0, 20).map((obj) => (
                  <TableRow key={obj.id}>
                    <TableCell className="max-w-xs truncate">{obj.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{obj.stage || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{obj.persona || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{obj.cluster || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      {obj.severity_score ? (
                        <span className={
                          obj.severity_score >= 7 ? 'text-red-600 font-bold' :
                          obj.severity_score >= 4 ? 'text-yellow-600 font-semibold' :
                          'text-green-600'
                        }>
                          {obj.severity_score}/10
                        </span>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {obj.probability_score ? `${obj.probability_score}%` : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
