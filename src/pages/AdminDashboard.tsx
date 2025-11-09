import { useState } from 'react';
import { SharedHeader } from '@/components/SharedHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Settings, Database, Users, Activity } from 'lucide-react';
import { CleanupStaleJobs } from '@/components/CleanupStaleJobs';
import { Badge } from '@/components/ui/badge';
import TenantManagement from './TenantManagement';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('system');

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Admin Dashboard" />
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Admin Control Center</h1>
            <p className="text-muted-foreground">Manage system operations, content, and users</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 mb-6">
            <TabsTrigger value="system" className="gap-2">
              <Activity className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2" disabled>
              <Database className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2" disabled>
              AI & Training
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2" disabled>
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* SYSTEM MANAGEMENT TAB */}
          <TabsContent value="system" className="space-y-6">
            {/* Processing Jobs Section */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Processing Jobs Management
                    </CardTitle>
                    <CardDescription>
                      Monitor and cleanup stale processing jobs
                    </CardDescription>
                  </div>
                  <CleanupStaleJobs />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTitle>What are stale jobs?</AlertTitle>
                  <AlertDescription>
                    Jobs that have been stuck in "processing" state for over 6 hours are considered stale. 
                    These typically occur when external services fail or timeout without proper error handling.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Detection Threshold</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">6 hours</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Jobs older than this are flagged
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Cleanup Action</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="destructive">Mark as Failed</Badge>
                      <p className="text-xs text-muted-foreground mt-2">
                        Stale jobs are marked failed to free resources
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Monitored Stages</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs space-y-1">
                        <div>• starting</div>
                        <div>• processing</div>
                        <div>• pending</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Tenant & User Management Section */}
            <Card className="border-l-4 border-l-orange">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Tenant & User Management
                </CardTitle>
                <CardDescription>
                  Manage tenant manual access and user permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TenantManagement />
              </CardContent>
            </Card>

            {/* Server Capacity Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Server Capacity Status
                </CardTitle>
                <CardDescription>
                  Current system capacity and performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="text-sm font-medium text-muted-foreground">Database</div>
                    <div className="text-2xl font-bold text-green-500 mt-1">Healthy</div>
                  </div>
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="text-sm font-medium text-muted-foreground">Edge Functions</div>
                    <div className="text-2xl font-bold text-green-500 mt-1">Online</div>
                  </div>
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="text-sm font-medium text-muted-foreground">Storage</div>
                    <div className="text-2xl font-bold text-green-500 mt-1">Available</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTENT MANAGEMENT TAB (Coming Soon) */}
          <TabsContent value="content">
            <Card>
              <CardHeader>
                <CardTitle>Content Management</CardTitle>
                <CardDescription>Coming in Phase 2</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This tab will include Manual Management, Upload Documents, and Game Management.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI & TRAINING TAB (Coming Soon) */}
          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle>AI & Training</CardTitle>
                <CardDescription>Coming in Phase 3</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This tab will include AI Configuration, Training Hub, and QA Analytics.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANALYTICS TAB (Coming Soon) */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>User Analytics</CardTitle>
                <CardDescription>Coming in Phase 4</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This tab will include User Conversations, Usage Tracking, and Strategic Analytics.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
