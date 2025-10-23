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
import Pricing from "./pages/Pricing";
import ProtectedRoute from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import ReIngestManual from "./pages/ReIngestManual";
import ManualProcessingTools from "./pages/ManualProcessingTools";

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
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
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
                <CodeAssistant />
              </ProtectedRoute>
            } />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/pricing" element={
              <ProtectedRoute>
                <Pricing />
              </ProtectedRoute>
            } />
            <Route path="/account-settings" element={
              <ProtectedRoute>
                <AccountSettings />
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
            <Route path="/reingest-manual" element={
              <ProtectedRoute>
                <AdminRoute>
                  <ReIngestManual />
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
