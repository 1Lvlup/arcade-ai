import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SharedHeader } from '@/components/SharedHeader';
import { AlertCircle, ClipboardCheck, FileText, Download, LogOut } from 'lucide-react';
import { useTrainingAuth } from '@/hooks/useTrainingAuth';
import { TrainingLogin } from '@/components/TrainingLogin';

export default function TrainingHub() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, adminKey } = useTrainingAuth();
  const [stats, setStats] = useState({ pending: 0, verified: 0, avgQuality: 0 });

  useEffect(() => {
    if (isAuthenticated && adminKey) {
      fetchStats();
    }
  }, [isAuthenticated, adminKey]);

  const fetchStats = async () => {
    try {
      // Fetch real stats from inbox
      const inboxRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/training-inbox?limit=1000`,
        { headers: { 'x-admin-key': adminKey! } }
      );
      const inboxData = await inboxRes.json();
      const pending = inboxData.items?.length || 0;

      // Fetch verified examples count
      const { supabase } = await import('@/integrations/supabase/client');
      const { count: verified } = await supabase
        .from('training_examples')
        .select('*', { count: 'exact', head: true })
        .eq('is_approved', true);

      // Calculate avg quality from inbox
      const avgQuality = inboxData.items?.reduce((sum: number, item: any) => 
        sum + (item.quality_score || 0), 0) / (pending || 1);

      setStats({ 
        pending, 
        verified: verified || 0, 
        avgQuality: avgQuality || 0 
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  if (!isAuthenticated) {
    return <TrainingLogin />;
  }

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Training Hub">
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </SharedHeader>
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Training Hub — Admin Console</h1>
            <p className="text-xl text-muted-foreground">
              One place to review model mistakes, verify fixes, and produce high-quality training data.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/training-hub/inbox')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <AlertCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Review Inbox</CardTitle>
                    <CardDescription>Review queries flagged for improvement</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button size="lg" className="w-full">
                  Start Reviewing
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/training-hub/qa-generate')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Generate QA</CardTitle>
                    <CardDescription>Auto-generate training questions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button size="lg" variant="outline" className="w-full">
                  Generate Questions
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/training-hub/examples')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ClipboardCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Training Examples</CardTitle>
                    <CardDescription>Manage verified training data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button size="lg" variant="outline" className="w-full">
                  View Examples
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/training-hub/export')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Download className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Export Data</CardTitle>
                    <CardDescription>Download training datasets</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button size="lg" variant="outline" className="w-full">
                  Export
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Pending Review</CardDescription>
                <CardTitle className="text-3xl">{stats.pending}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Verified Examples</CardDescription>
                <CardTitle className="text-3xl">{stats.verified}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Avg Quality Score</CardDescription>
                <CardTitle className="text-3xl">{stats.avgQuality.toFixed(2)}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
