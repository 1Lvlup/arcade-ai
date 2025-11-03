import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, AlertCircle } from 'lucide-react';
import { useTrainingAuth } from '@/hooks/useTrainingAuth';

export function TrainingLogin() {
  const { user, isAdmin, loading } = useTrainingAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is logged in and is admin, redirect to hub
    if (user && isAdmin) {
      navigate('/training-hub');
    }
  }, [user, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">Training Hub Access</CardTitle>
            <CardDescription className="mt-2">
              {!user ? (
                'Please log in to access the Training Hub'
              ) : !isAdmin ? (
                'Admin access required'
              ) : (
                'Redirecting...'
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <Button 
              className="w-full" 
              onClick={() => navigate('/auth')}
            >
              Go to Login
            </Button>
          ) : !isAdmin && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg text-sm">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Admin Access Required</p>
                <p className="text-muted-foreground mt-1">
                  Your account does not have admin privileges. Please contact the system administrator.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
