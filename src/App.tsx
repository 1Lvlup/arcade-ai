import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ManualManagement from "./pages/ManualManagement";
import { ManualDetail } from "./pages/ManualDetail";
import ManualDetails from "./pages/ManualDetails";
import VisionBoard from "./pages/VisionBoard";
import AIConfiguration from "./pages/AIConfiguration";
import ManualAdmin from "./pages/ManualAdmin";
import ManualAdminEdit from "./pages/ManualAdminEdit";
import ProtectedRoute from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
            <Route path="/manuals/:manualId" element={
              <ProtectedRoute>
                <ManualDetail />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
