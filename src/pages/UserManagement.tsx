import { useState, useEffect } from 'react';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Users, Crown, Mail, Calendar } from 'lucide-react';

interface UserProfile {
  user_id: string;
  email: string;
  created_at: string;
  fec_tenant_id: string;
}

interface UsageLimit {
  fec_tenant_id: string;
  manual_override: boolean;
  override_reason: string | null;
  override_set_at: string | null;
}

interface UserWithAccess extends UserProfile {
  manual_override: boolean;
  override_reason: string | null;
  override_set_at: string | null;
}

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithAccess | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, created_at, fec_tenant_id')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        setUsers([]);
        return;
      }

      // Fetch usage limits for all tenants
      const tenantIds = profiles.map(p => p.fec_tenant_id);
      const { data: limits, error: limitsError } = await supabase
        .from('usage_limits')
        .select('fec_tenant_id, manual_override, override_reason, override_set_at')
        .in('fec_tenant_id', tenantIds);

      if (limitsError) throw limitsError;

      // Merge the data
      const limitsMap = new Map<string, UsageLimit>();
      limits?.forEach(limit => {
        limitsMap.set(limit.fec_tenant_id, limit);
      });

      const usersWithAccess: UserWithAccess[] = profiles.map(profile => {
        const limit = limitsMap.get(profile.fec_tenant_id);
        return {
          ...profile,
          manual_override: limit?.manual_override || false,
          override_reason: limit?.override_reason || null,
          override_set_at: limit?.override_set_at || null,
        };
      });

      setUsers(usersWithAccess);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (userToEdit: UserWithAccess) => {
    setSelectedUser(userToEdit);
    setOverrideReason(userToEdit.override_reason || '');
    setDialogOpen(true);
  };

  const handleSaveAccess = async () => {
    if (!selectedUser || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('usage_limits')
        .update({
          manual_override: selectedUser.manual_override,
          override_reason: overrideReason || null,
          override_set_by: user.id,
          override_set_at: new Date().toISOString(),
        })
        .eq('fec_tenant_id', selectedUser.fec_tenant_id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Access updated for ${selectedUser.email}`,
      });

      setDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update access',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleOverride = (checked: boolean) => {
    if (selectedUser) {
      setSelectedUser({
        ...selectedUser,
        manual_override: checked,
      });
    }
  };

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="User Management" showBackButton={true} backTo="/" />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              All Users
            </CardTitle>
            <CardDescription>
              Manage user access levels and grant manual overrides for full access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No users found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Access Status</TableHead>
                    <TableHead>Override Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userProfile) => (
                    <TableRow key={userProfile.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{userProfile.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {new Date(userProfile.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {userProfile.manual_override ? (
                          <Badge variant="default" className="gap-1">
                            <Crown className="h-3 w-3" />
                            Full Access
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Standard</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {userProfile.override_set_at ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(userProfile.override_set_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(userProfile)}
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Access Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage User Access</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="manual-override" className="text-base font-semibold">
                  Grant Full Access
                </Label>
                <p className="text-sm text-muted-foreground">
                  Give this user unlimited access regardless of their subscription status
                </p>
              </div>
              <Switch
                id="manual-override"
                checked={selectedUser?.manual_override || false}
                onCheckedChange={toggleOverride}
              />
            </div>

            {selectedUser?.manual_override && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Override</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Beta tester, Partner account, Special arrangement..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  This note helps track why manual access was granted
                </p>
              </div>
            )}

            {selectedUser?.override_set_at && (
              <div className="rounded-lg bg-muted p-4 space-y-1">
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedUser.override_set_at).toLocaleString()}
                </p>
                {selectedUser.override_reason && (
                  <>
                    <p className="text-sm font-medium pt-2">Current Reason</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.override_reason}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAccess} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
