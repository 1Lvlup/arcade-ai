import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TrainingAuthProvider } from "@/hooks/useTrainingAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import WhatIsLevelUp from "./pages/WhatIsLevelUp";
import ManualManagement from "./pages/ManualManagement";
import Chat from "./pages/Chat";
import { ManualDetail } from "./pages/ManualDetail";
import ManualDetails from "./pages/ManualDetails";
import VisionBoard from "./pages/VisionBoard";
import AIConfiguration from "./pages/AIConfiguration";
import ManualAdmin from "./pages/ManualAdmin";
import ManualAdminEdit from "./pages/ManualAdminEdit";
import TenantManagement from "./pages/TenantManagement";
import { TrainingDashboard } from "./pages/TrainingDashboard";
import { CodeAssistant } from "./pages/CodeAssistant";
import TrainingHub from "./pages/TrainingHub";
import TrainingInbox from "./pages/TrainingInbox";
import TrainingInboxDetail from "./pages/TrainingInboxDetail";
import TrainingQAGeneration from "./pages/TrainingQAGeneration";
import TrainingExport from "./pages/TrainingExport";
import TrainingExamples from "./pages/TrainingExamples";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AccountSettings from "./pages/AccountSettings";
import Support from "./pages/Support";
import SupportTickets from "./pages/SupportTickets";
import QAAnalytics from "./pages/QAAnalytics";
import RAGTestingLab from "./pages/RAGTestingLab";
import Pricing from "./pages/Pricing";
import ServerCapacity from "./pages/ServerCapacity";
import ProtectedRoute from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import ReIngestManual from "./pages/ReIngestManual";
import ManualProcessingTools from "./pages/ManualProcessingTools";
import UserConversationHistory from "./pages/UserConversationHistory";
import AddGames from "./pages/AddGames";
import GameManagement from "./pages/GameManagement";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import Forum from "./pages/Forum";
import ForumPost from "./pages/ForumPost";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BlogAdmin from "./pages/BlogAdmin";
import BlogEditor from "./pages/BlogEditor";
import LeadIntelligence from "./pages/LeadIntelligence";
import OutboundLeads from "./pages/OutboundLeads";
import OutboundOutreach from "./pages/OutboundOutreach";
import OutboundTasks from "./pages/OutboundTasks";
import OutboundDemo from "./pages/OutboundDemo";
import OutboundObjections from "./pages/OutboundObjections";
import OutboundPipeline from "./pages/OutboundPipeline";
import OutboundImport from "./pages/OutboundImport";
import OutboundCommand from "./pages/OutboundCommand";
import QualityMetrics from "./pages/QualityMetrics";
import DownGamesDashboard from "./pages/DownGamesDashboard";
import Contact from "./pages/Contact";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TrainingAuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Index />} />
              <Route path="/what-is-level-up" element={<WhatIsLevelUp />} />
              <Route path="/manuals" element={
                <ProtectedRoute>
                  <ManualManagement />
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } />
              <Route path="/forum" element={<Forum />} />
              <Route path="/forum/:id" element={<ForumPost />} />
              <Route path="/manuals/:manualId" element={
                <ProtectedRoute>
                  <ManualDetail />
                </ProtectedRoute>
              } />
              <Route path="/manuals/:manualId/tools" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <ManualProcessingTools />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/vision-board" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <VisionBoard />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/ai-config" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AIConfiguration />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/rag-testing-lab" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <RAGTestingLab />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/manual-admin" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <ManualAdmin />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/manual-admin/edit/:manualId" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <ManualAdminEdit />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/manual-admin/new" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <ManualAdminEdit />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/tenant-management" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <TenantManagement />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/training-dashboard" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <TrainingDashboard />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/code-assistant" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <CodeAssistant />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/server-capacity" element={<ServerCapacity />} />
              <Route path="/account-settings" element={
                <ProtectedRoute>
                  <AccountSettings />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/support" element={
                <ProtectedRoute>
                  <Support />
                </ProtectedRoute>
              } />
              <Route path="/support-tickets" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <SupportTickets />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/training-hub" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <TrainingHub />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/training-hub/inbox" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <TrainingInbox />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/training-hub/review/:id" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <TrainingInboxDetail />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/training-hub/qa-generate" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <TrainingQAGeneration />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/training-hub/export" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <TrainingExport />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/training-hub/examples" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <TrainingExamples />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/qa-analytics" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <QAAnalytics />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/quality-metrics" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <QualityMetrics />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/reingest-manual" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <ReIngestManual />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/user-conversations" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <UserConversationHistory />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/add-games" element={
                <ProtectedRoute>
                  <AddGames />
                </ProtectedRoute>
              } />
              <Route path="/game-management" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <GameManagement />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/downgames" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <DownGamesDashboard />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/contact" element={<Contact />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/admin/blog" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <BlogAdmin />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/blog/new" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <BlogEditor />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/blog/edit/:id" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <BlogEditor />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/lead-intelligence" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <LeadIntelligence />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/outbound-leads" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <OutboundLeads />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/outbound-outreach" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <OutboundOutreach />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/outbound-tasks" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <OutboundTasks />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/outbound-demo" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <OutboundDemo />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/outbound-objections" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <OutboundObjections />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/outbound-pipeline" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <OutboundPipeline />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/outbound-import" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <OutboundImport />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/outbound-command" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <OutboundCommand />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TrainingAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
