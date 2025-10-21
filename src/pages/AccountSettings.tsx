import { useState } from 'react';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { useSubscription, SUBSCRIPTION_TIERS } from '@/hooks/useSubscription';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { User, Lock, Mail, Trash2, CreditCard, ExternalLink } from 'lucide-react';

export default function AccountSettings() {
  const { user, updatePassword, signOut } = useAuth();
  const { toast } = useToast();
  const { isSubscribed, currentTier, subscriptionEnd, isLoading: subscriptionLoading } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Password update states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(newPassword);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Password updated successfully',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setLoading(true);
    
    try {
      // Delete user account (this will cascade delete related data via RLS)
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) throw error;

      toast({
        title: 'Account Deleted',
        description: 'Your account has been permanently deleted',
      });
      
      await signOut();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete account',
        variant: 'destructive',
      });
    }
    
    setLoading(false);
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to open customer portal',
        variant: 'destructive',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const getTierInfo = () => {
    if (!currentTier) return null;
    const tierConfig = SUBSCRIPTION_TIERS[currentTier];
    return {
      name: tierConfig.name,
      price: tierConfig.price,
      interval: tierConfig.interval,
    };
  };

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Account Settings" showBackButton={true} backTo="/" />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Subscription Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Subscription
            </CardTitle>
            <CardDescription>Manage your subscription plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriptionLoading ? (
              <p className="text-sm text-muted-foreground">Loading subscription status...</p>
            ) : isSubscribed && getTierInfo() ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Current Plan</span>
                    <span className="text-lg font-bold text-primary">
                      {getTierInfo()?.name} - ${getTierInfo()?.price}/{getTierInfo()?.interval === 'month' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  {subscriptionEnd && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Renews On</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(subscriptionEnd).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleManageSubscription} 
                  disabled={portalLoading}
                  className="w-full"
                >
                  {portalLoading ? 'Loading...' : 'Manage Subscription'}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Update payment method, cancel, or change your plan
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  You don't have an active subscription
                </p>
                <Button onClick={() => window.location.href = '/pricing'} className="w-full">
                  View Plans
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Account Information
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-id" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                User ID
              </Label>
              <div className="flex gap-2">
                <Input
                  id="user-id"
                  type="text"
                  value={user?.id || ''}
                  disabled
                  className="bg-muted font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(user?.id || '');
                    toast({
                      title: 'Copied!',
                      description: 'User ID copied to clipboard',
                    });
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Use this ID to assign admin role in the database
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Email address cannot be changed. Contact support if you need to update it.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Change Password
            </CardTitle>
            <CardDescription>Update your password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions that will permanently affect your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Delete Account</h3>
              <p className="text-sm text-muted-foreground">
                Once you delete your account, there is no going back. This will permanently delete
                your account, all your data, feedback, and query history.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="mt-2"
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
