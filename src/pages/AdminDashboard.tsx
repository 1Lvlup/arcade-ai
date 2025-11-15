import { useState } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Settings, Database, Users, Activity, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CleanupStaleJobs } from '@/components/CleanupStaleJobs';
import { Badge } from '@/components/ui/badge';
import TenantManagement from './TenantManagement';
import { ManualUpload } from '@/components/ManualUpload';
import { ManualsList } from '@/components/ManualsList';
import { BulkManualImport } from '@/components/BulkManualImport';
import { StructuredCSVImport } from '@/components/StructuredCSVImport';
import { ManualMerge } from '@/components/ManualMerge';
import GameManagement from './GameManagement';
import ManualAdmin from './ManualAdmin';
import { GameRequestsList } from '@/components/GameRequestsList';
import AIConfiguration from './AIConfiguration';
import TrainingInbox from './TrainingInbox';
import TrainingExamples from './TrainingExamples';
import TrainingQAGeneration from './TrainingQAGeneration';
import TrainingExport from './TrainingExport';
import QAAnalytics from './QAAnalytics';
import UserConversationHistory from './UserConversationHistory';
import { UsageTrackingDashboard } from '@/components/UsageTrackingDashboard';
import { StrategicAnalytics } from '@/components/StrategicAnalytics';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('system');

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
            <SidebarTrigger className="-ml-1" />
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Admin Control Center</h1>
                <p className="text-xs text-muted-foreground">Centralized management hub</p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Hide tab list since we have sidebar navigation */}
              <TabsList className="sr-only">
                <TabsTrigger value="system">System</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="ai">AI & Training</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* SYSTEM MANAGEMENT TAB */}
              <TabsContent value="system" className="space-y-6 mt-0">
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

              {/* CONTENT MANAGEMENT TAB */}
              <TabsContent value="content" className="space-y-6 mt-0">
                {/* Manual Administration */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Manual Administration
                    </CardTitle>
                    <CardDescription>
                      Manage manual metadata, indexing, and backfill operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ManualAdmin />
                  </CardContent>
                </Card>

                {/* Document Upload & Processing */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle>Document Upload & Processing</CardTitle>
                    <CardDescription>
                      Upload and manage individual documents and bulk imports
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <ManualUpload />
                      <ManualsList />
                    </div>
                    
                    <div className="space-y-6">
                      <StructuredCSVImport />
                      <BulkManualImport />
                      <ManualMerge />
                    </div>
                  </CardContent>
                </Card>

                {/* Game Requests & Management */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card className="border-l-4 border-l-yellow-500">
                    <CardHeader>
                      <CardTitle>Game Requests</CardTitle>
                      <CardDescription>
                        View and manage game requests from users
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <GameRequestsList />
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-purple-500">
                    <CardHeader>
                      <CardTitle>Game Management</CardTitle>
                      <CardDescription>
                        Manage game submissions and metadata
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <GameManagement />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* AI & TRAINING TAB */}
              <TabsContent value="ai" className="space-y-6 mt-0">
                {/* AI Configuration */}
                <Card className="border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      AI Configuration
                    </CardTitle>
                    <CardDescription>
                      Manage AI models, system prompts, and search settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AIConfiguration />
                  </CardContent>
                </Card>

                {/* Training Hub Overview */}
                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          Training Hub
                        </CardTitle>
                        <CardDescription>
                          Review queries, manage examples, and generate QA data
                        </CardDescription>
                      </div>
                      <Button variant="outline" onClick={() => window.location.href = '/training-hub'}>
                        Open Training Hub
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertTitle>Quick Access</AlertTitle>
                      <AlertDescription>
                        Access detailed training workflows, review individual queries, and manage training examples in the dedicated Training Hub interface.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/training-hub/inbox'}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Training Inbox</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">Review flagged queries and improve responses</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/training-hub/examples'}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Training Examples</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">Manage verified training examples</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/training-hub/qa-generate'}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">QA Generation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">Generate Q&A pairs for training</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/training-hub/export'}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Export Training Data</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">Export verified examples for fine-tuning</p>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                {/* QA Analytics */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      QA Analytics
                    </CardTitle>
                    <CardDescription>
                      Comprehensive analysis of AI responses with quality grades
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <QAAnalytics />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ANALYTICS TAB */}
              <TabsContent value="analytics" className="space-y-6 mt-0">
                {/* User Conversation History */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      User Conversation History
                    </CardTitle>
                    <CardDescription>
                      View and analyze all user conversations across tenants
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertTitle>How to use</AlertTitle>
                      <AlertDescription>
                        1. Select a user from the dropdown to view their conversations<br />
                        2. Click on a conversation to view its message history
                      </AlertDescription>
                    </Alert>
                    <UserConversationHistoryView />
                  </CardContent>
                </Card>

                {/* Usage & Performance */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card className="border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Usage Tracking
                      </CardTitle>
                      <CardDescription>
                        Monitor query usage and limits
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <UsageTrackingDashboard />
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-purple-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Strategic Analytics
                      </CardTitle>
                      <CardDescription>
                        Performance metrics and trends
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <StrategicAnalytics />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
