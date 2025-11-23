import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MessageSquare, Clock, Users, CheckCircle, TrendingUp } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SMSLog {
  id: string;
  created_at: string;
  phone_number: string;
  event_type: string;
  question_text: string | null;
  ai_response: string | null;
  response_time_ms: number | null;
  truncated: boolean;
  facility_name: string | null;
  topic_category: string | null;
  error_message: string | null;
  user_id: string | null;
}

interface AnalyticsSummary {
  totalMessages: number;
  avgResponseTime: number;
  activeUsers: number;
  successRate: number;
}

interface TopicData {
  topic: string;
  count: number;
}

interface TechnicianActivity {
  phone_number: string;
  facility_name: string | null;
  message_count: number;
  last_activity: string;
  avg_response_time: number;
  top_topic: string | null;
}

const TOPIC_COLORS: Record<string, string> = {
  power: 'hsl(var(--chart-1))',
  controls: 'hsl(var(--chart-2))',
  audio: 'hsl(var(--chart-3))',
  display: 'hsl(var(--chart-4))',
  coin_mechanism: 'hsl(var(--chart-5))',
  network: 'hsl(var(--primary))',
  error_code: 'hsl(var(--destructive))',
  other: 'hsl(var(--muted-foreground))',
};

const TOPIC_LABELS: Record<string, string> = {
  power: 'Power/Electrical',
  controls: 'Controls/Buttons',
  audio: 'Audio/Sound',
  display: 'Display/Monitor',
  coin_mechanism: 'Coin Mechanism',
  network: 'Network/Connectivity',
  error_code: 'Error Codes',
  other: 'Other',
};

export function SMSAnalyticsDashboard() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [topicData, setTopicData] = useState<TopicData[]>([]);
  const [techActivity, setTechActivity] = useState<TechnicianActivity[]>([]);
  const [timeRange, setTimeRange] = useState<string>('7');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const days = parseInt(timeRange);
      const startDate = startOfDay(subDays(new Date(), days));
      
      // Fetch SMS logs
      const { data: logsData, error } = await supabase
        .from('sms_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLogs(logsData || []);

      // Calculate summary metrics
      const messages = logsData?.filter(log => log.event_type === 'message') || [];
      const totalMessages = messages.length;
      const successfulMessages = messages.filter(log => !log.error_message);
      const avgResponseTime = messages.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / totalMessages || 0;
      const activeUsers = new Set(logsData?.map(log => log.phone_number)).size;
      const successRate = totalMessages > 0 ? (successfulMessages.length / totalMessages) * 100 : 0;

      setSummary({
        totalMessages,
        avgResponseTime: Math.round(avgResponseTime),
        activeUsers,
        successRate: Math.round(successRate),
      });

      // Calculate topic distribution
      const topicCounts: Record<string, number> = {};
      messages.forEach(log => {
        const topic = log.topic_category || 'other';
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });

      const topicDataArray = Object.entries(topicCounts)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count);

      setTopicData(topicDataArray);

      // Calculate technician activity
      const techMap: Record<string, TechnicianActivity> = {};
      logsData?.forEach(log => {
        if (!techMap[log.phone_number]) {
          techMap[log.phone_number] = {
            phone_number: log.phone_number,
            facility_name: log.facility_name,
            message_count: 0,
            last_activity: log.created_at,
            avg_response_time: 0,
            top_topic: null,
          };
        }

        const tech = techMap[log.phone_number];
        tech.message_count++;
        if (new Date(log.created_at) > new Date(tech.last_activity)) {
          tech.last_activity = log.created_at;
        }
      });

      // Calculate avg response times and top topics per tech
      Object.keys(techMap).forEach(phone => {
        const techLogs = messages.filter(log => log.phone_number === phone);
        const responseTimes = techLogs.filter(log => log.response_time_ms).map(log => log.response_time_ms!);
        techMap[phone].avg_response_time = responseTimes.length > 0
          ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
          : 0;

        const techTopics: Record<string, number> = {};
        techLogs.forEach(log => {
          const topic = log.topic_category || 'other';
          techTopics[topic] = (techTopics[topic] || 0) + 1;
        });
        const topTopic = Object.entries(techTopics).sort((a, b) => b[1] - a[1])[0];
        techMap[phone].top_topic = topTopic ? topTopic[0] : null;
      });

      setTechActivity(Object.values(techMap).sort((a, b) => b.message_count - a.message_count));

    } catch (error) {
      console.error('Error fetching SMS analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>;
  }

  if (!summary) {
    return <div className="text-center py-8 text-muted-foreground">No SMS data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Time Range Filter */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">SMS Support Analytics</h3>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 Hours</SelectItem>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total SMS</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalMessages}</div>
            <p className="text-xs text-muted-foreground">Questions asked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.avgResponseTime / 1000).toFixed(1)}s</div>
            <p className="text-xs text-muted-foreground">Average AI response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Technicians</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Unique users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate}%</div>
            <p className="text-xs text-muted-foreground">Successful responses</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <Tabs defaultValue="topics" className="w-full">
        <TabsList>
          <TabsTrigger value="topics">Popular Topics</TabsTrigger>
          <TabsTrigger value="technicians">Technician Activity</TabsTrigger>
          <TabsTrigger value="recent">Recent Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Question Topics Distribution</CardTitle>
              <CardDescription>What technicians are asking about</CardDescription>
            </CardHeader>
            <CardContent>
              {topicData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topicData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="topic" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => TOPIC_LABELS[value] || value}
                    />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))' 
                      }}
                      labelFormatter={(value) => TOPIC_LABELS[value] || value}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No topic data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technicians" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Technician Activity</CardTitle>
              <CardDescription>SMS usage by technician</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Avg Response</TableHead>
                    <TableHead>Top Topic</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {techActivity.slice(0, 10).map((tech) => (
                    <TableRow key={tech.phone_number}>
                      <TableCell className="font-mono text-sm">{tech.phone_number}</TableCell>
                      <TableCell>{tech.facility_name || 'Unknown'}</TableCell>
                      <TableCell>{tech.message_count}</TableCell>
                      <TableCell>{(tech.avg_response_time / 1000).toFixed(1)}s</TableCell>
                      <TableCell>
                        {tech.top_topic && (
                          <Badge variant="outline" style={{ borderColor: TOPIC_COLORS[tech.top_topic] }}>
                            {TOPIC_LABELS[tech.top_topic]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(tech.last_activity), 'MMM d, h:mm a')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent SMS Messages</CardTitle>
              <CardDescription>Latest SMS interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Response Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.filter(log => log.event_type === 'message').slice(0, 20).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.phone_number}</TableCell>
                      <TableCell>{log.facility_name || 'Unknown'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.question_text || log.error_message || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {log.topic_category && (
                          <Badge variant="secondary" style={{ backgroundColor: TOPIC_COLORS[log.topic_category] + '20' }}>
                            {TOPIC_LABELS[log.topic_category]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.response_time_ms ? `${(log.response_time_ms / 1000).toFixed(1)}s` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {log.error_message ? (
                          <Badge variant="destructive">Error</Badge>
                        ) : log.truncated ? (
                          <Badge variant="outline">Truncated</Badge>
                        ) : (
                          <Badge variant="default">Success</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
