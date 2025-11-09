import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Activity,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface UsageStat {
  fec_tenant_id: string;
  queries_used_this_week: number;
  queries_per_week: number;
  week_start: string;
  manual_override: boolean;
  override_reason: string | null;
}

interface TenantInfo {
  id: string;
  name: string;
  email: string;
}

export function UsageTrackingDashboard() {
  const { toast } = useToast();
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [tenants, setTenants] = useState<Map<string, TenantInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalTenants: 0,
    activeThisWeek: 0,
    totalQueriesThisWeek: 0,
    averageUsage: 0,
    overLimitCount: 0,
    manualOverrideCount: 0
  });

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    setLoading(true);
    try {
      // Fetch usage limits
      const { data: usageData, error: usageError } = await supabase
        .from('usage_limits')
        .select('*')
        .order('queries_used_this_week', { ascending: false });

      if (usageError) throw usageError;

      // Fetch tenant info
      const { data: tenantData, error: tenantError } = await supabase
        .from('fec_tenants')
        .select('id, name, email');

      if (tenantError) throw tenantError;

      const tenantMap = new Map<string, TenantInfo>();
      tenantData?.forEach(t => tenantMap.set(t.id, t));
      setTenants(tenantMap);
      setUsageStats(usageData || []);

      // Calculate summary
      const stats = usageData || [];
      const totalQueries = stats.reduce((sum, s) => sum + s.queries_used_this_week, 0);
      const activeCount = stats.filter(s => s.queries_used_this_week > 0).length;
      const overLimit = stats.filter(s => 
        !s.manual_override && s.queries_used_this_week >= s.queries_per_week
      ).length;
      const withOverride = stats.filter(s => s.manual_override).length;

      setSummary({
        totalTenants: stats.length,
        activeThisWeek: activeCount,
        totalQueriesThisWeek: totalQueries,
        averageUsage: stats.length > 0 ? totalQueries / stats.length : 0,
        overLimitCount: overLimit,
        manualOverrideCount: withOverride
      });
    } catch (error) {
      console.error('Error fetching usage data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load usage data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageBadge = (used: number, limit: number, hasOverride: boolean) => {
    if (hasOverride) {
      return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" /> Override</Badge>;
    }
    const percentage = (used / limit) * 100;
    if (percentage >= 100) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Over Limit</Badge>;
    }
    if (percentage >= 80) {
      return <Badge variant="default" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 gap-1">
        <AlertCircle className="h-3 w-3" /> High Usage
      </Badge>;
    }
    return <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3" /> Normal</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">Loading usage data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTenants}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.activeThisWeek} active this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalQueriesThisWeek}</div>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">
                Avg: {summary.averageUsage.toFixed(1)} per tenant
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Over Limit:</span>
                <span className="font-bold text-red-500">{summary.overLimitCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">With Override:</span>
                <span className="font-bold">{summary.manualOverrideCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Details */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Usage Details</CardTitle>
          <CardDescription>
            Query usage and limits per tenant for current week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usageStats.map((stat) => {
              const tenant = tenants.get(stat.fec_tenant_id);
              const percentage = getUsagePercentage(stat.queries_used_this_week, stat.queries_per_week);
              
              return (
                <Card key={stat.fec_tenant_id} className="border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{tenant?.name || 'Unknown Tenant'}</h4>
                            {getUsageBadge(stat.queries_used_this_week, stat.queries_per_week, stat.manual_override)}
                          </div>
                          <p className="text-sm text-muted-foreground">{tenant?.email}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {stat.queries_used_this_week}
                            <span className="text-sm text-muted-foreground font-normal">
                              {' / '}{stat.queries_per_week}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">queries</p>
                        </div>
                      </div>

                      <Progress value={percentage} className="h-2" />

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Week starts: {format(new Date(stat.week_start), 'MMM d, yyyy')}
                        </div>
                        <span>{percentage.toFixed(1)}% used</span>
                      </div>

                      {stat.manual_override && stat.override_reason && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <span className="font-medium">Override reason: </span>
                          {stat.override_reason}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {usageStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No usage data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
