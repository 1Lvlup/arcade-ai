import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    async function checkAdminRole() {
      if (!user) {
        setCheckingRole(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (error) {
          console.error('Error checking admin role:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data);
        }
      } catch (err) {
        console.error('Error checking admin role:', err);
        setIsAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    }

    checkAdminRole();
  }, [user]);

  if (loading || checkingRole) {
    return (
      <div className="min-h-screen arcade-bg flex items-center justify-center">
        <Card className="border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying access...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen arcade-bg flex items-center justify-center">
        <Card className="border-destructive/20 max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-destructive mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                This area is restricted to authorized personnel only.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Contact system administrator if you believe this is an error.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Secret access indicator */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center space-x-2 bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-lg px-3 py-1">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono text-primary">ADMIN ACCESS</span>
        </div>
      </div>
      {children}
    </div>
  );
}