import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface AdminOrSubscriptionRouteProps {
  children: ReactNode;
}

export default function AdminOrSubscriptionRoute({ children }: AdminOrSubscriptionRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isSubscribed, isLoading: subscriptionLoading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdminCheck();

  if (authLoading || subscriptionLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground font-body">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Allow access if user is admin OR has subscription
  if (!isAdmin && !isSubscribed) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
}
