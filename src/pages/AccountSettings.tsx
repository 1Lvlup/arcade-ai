import { useState, useEffect } from 'react';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { User, Lock, Mail, Trash2, CreditCard, ExternalLink, MessageSquare } from 'lucide-react';

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

  // SMS opt-in states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [smsOptInDate, setSmsOptInDate] = useState<string | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

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

  // Load SMS preferences
  useEffect(() => {
    const loadSmsPreferences = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('phone_number, sms_opt_in, sms_opt_in_date')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setPhoneNumber(data.phone_number || '');
        setSmsOptIn(data.sms_opt_in || false);
        setSmsOptInDate(data.sms_opt_in_date);
      }
    };

    loadSmsPreferences();
  }, [user]);

  // Validate and format phone number to E.164 format
  const validateAndFormatPhone = (phone: string): { valid: boolean; formatted: string; error: string } => {
    if (!phone.trim()) {
      return { valid: true, formatted: "", error: "" };
    }

    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it already starts with +, validate it
    if (cleaned.startsWith('+')) {
      const digitsOnly = cleaned.substring(1);
      if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return { valid: true, formatted: cleaned, error: "" };
      }
      return { 
        valid: false, 
        formatted: phone, 
        error: "Please use format: +1 followed by 10 digits (e.g., +17017209099)" 
      };
    }
    
    // Remove all non-digits
    const digitsOnly = cleaned.replace(/\D/g, '');
    
    // Check if it's a valid US number (10 digits) or already has country code (11 digits starting with 1)
    if (digitsOnly.length === 10) {
      return { valid: true, formatted: `+1${digitsOnly}`, error: "" };
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return { valid: true, formatted: `+${digitsOnly}`, error: "" };
    } else {
      return { 
        valid: false, 
        formatted: phone, 
        error: "Please enter a valid US phone number (10 digits)" 
      };
    }
  };

  const handleSmsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate phone number
    const validation = validateAndFormatPhone(phoneNumber);
    if (!validation.valid) {
      setPhoneError(validation.error);
      return;
    }
    setPhoneError("");

    // Require phone number if enabling SMS
    if (smsOptIn && !validation.formatted) {
      setPhoneError("Phone number is required to enable SMS notifications");
      return;
    }

    setSmsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          phone_number: validation.formatted || null,
          sms_opt_in: smsOptIn,
          sms_opt_in_date: smsOptIn ? new Date().toISOString() : null,
          sms_opt_out_date: !smsOptIn ? new Date().toISOString() : null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state with formatted number
      setPhoneNumber(validation.formatted);

      toast({
        title: 'Success',
        description: smsOptIn 
          ? `SMS notifications enabled at ${validation.formatted}. You can now text questions!`
          : 'SMS preferences updated successfully',
      });

      if (smsOptIn) {
        setSmsOptInDate(new Date().toISOString());
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update SMS preferences',
        variant: 'destructive',
      });
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <SharedHeader title="Account Settings" showBackButton={true} backTo="/" />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Subscription Status */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tech text-white">
              <CreditCard className="h-5 w-5 text-orange" />
              SUBSCRIPTION
            </CardTitle>
            <CardDescription className="text-muted-foreground">Manage your subscription plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriptionLoading ? (
              <p className="text-sm text-muted-foreground">Loading subscription status...</p>
            ) : isSubscribed && getTierInfo() ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Current Plan</span>
                    <span className="text-lg font-bold text-orange">
                      {getTierInfo()?.name} - ${getTierInfo()?.price}/{getTierInfo()?.interval === 'month' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  {subscriptionEnd && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">Renews On</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(subscriptionEnd).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleManageSubscription} 
                  disabled={portalLoading}
                  className="w-full bg-orange hover:bg-orange/80 text-white font-tech"
                >
                  {portalLoading ? 'LOADING...' : 'MANAGE SUBSCRIPTION'}
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
                <Button onClick={() => window.location.href = '/pricing'} className="w-full bg-orange hover:bg-orange/80 text-white font-tech">
                  VIEW PLANS
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        {/* Account Information */}
        <Card className="bg-white/5 border-white/10">
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

        {/* SMS Notifications */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tech text-white">
              <MessageSquare className="h-5 w-5 text-orange" />
              SMS NOTIFICATIONS
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Receive troubleshooting answers via text message
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSmsUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone-number" className="text-white">Phone Number</Label>
                <Input
                  id="phone-number"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setPhoneError("");
                  }}
                  placeholder="+1 (555) 123-4567"
                  className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground ${
                    phoneError ? 'border-red-500' : ''
                  }`}
                />
                {phoneError ? (
                  <p className="text-xs text-red-500">{phoneError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enter US phone number (will be formatted to E.164: +1...)
                  </p>
                )}
              </div>

              <div className="flex items-start space-x-3 space-y-0 rounded-md border border-white/10 p-4 bg-white/5">
                <Checkbox
                  id="sms-consent"
                  checked={smsOptIn}
                  onCheckedChange={(checked) => setSmsOptIn(checked as boolean)}
                  className="mt-1"
                />
                <div className="space-y-1 leading-none">
                  <Label
                    htmlFor="sms-consent"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white cursor-pointer"
                  >
                    I agree to receive SMS messages from Level Up AI
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive troubleshooting support via text message. Message and data rates may apply. 
                    Reply STOP to opt-out at any time.
                  </p>
                </div>
              </div>

              {smsOptInDate && smsOptIn && (
                <div className="text-xs text-muted-foreground bg-white/5 p-3 rounded-md border border-white/10">
                  ✓ SMS enabled on {new Date(smsOptInDate).toLocaleDateString()}
                </div>
              )}

              <Button 
                type="submit" 
                disabled={smsLoading || !phoneNumber.trim()}
                className="w-full bg-orange hover:bg-orange/80 text-white font-tech"
              >
                {smsLoading ? 'SAVING...' : smsOptIn ? 'UPDATE SMS PREFERENCES' : 'ENABLE SMS SUPPORT'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lock className="h-5 w-5 text-primary" />
              Change Password
            </CardTitle>
            <CardDescription className="text-muted-foreground">Update your password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-white">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="bg-white/5 border-white/10 text-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-white">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="bg-white/5 border-white/10 text-white"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="bg-orange hover:bg-orange/80 text-white">
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator className="bg-white/10" />

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
