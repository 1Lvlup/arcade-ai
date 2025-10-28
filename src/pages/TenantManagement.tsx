import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Calendar, Crown, User } from 'lucide-react';
import { SharedHeader } from '@/components/SharedHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';

interface Tenant {
  id: string;
  name: string;
  email: string;
}

interface Manual {
  manual_id: string;
  canonical_title: string;
  platform?: string;
}

interface TenantAccess {
  [manualId: string]: boolean;
}

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

export default function TenantManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Tenant Manual Access state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [tenantAccess, setTenantAccess] = useState<TenantAccess>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // User Management state
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithAccess | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [userSaving, setUserSaving] = useState(false);

  useEffect(() => {
    fetchTenantsAndManuals();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetchTenantAccess(selectedTenant);
    }
  }, [selectedTenant]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, created_at, fec_tenant_id')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        setUsers([]);
        return;
      }

      const tenantIds = profiles.map(p => p.fec_tenant_id);
      const { data: limits, error: limitsError } = await supabase
        .from('usage_limits')
        .select('fec_tenant_id, manual_override, override_reason, override_set_at')
        .in('fec_tenant_id', tenantIds);

      if (limitsError) throw limitsError;

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
      setUsersLoading(false);
    }
  };

  const openEditDialog = (userToEdit: UserWithAccess) => {
    setSelectedUser(userToEdit);
    setOverrideReason(userToEdit.override_reason || '');
    setDialogOpen(true);
  };

  const handleSaveAccess = async () => {
    if (!selectedUser || !user) return;

    setUserSaving(true);
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
      setUserSaving(false);
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

  const fetchTenantsAndManuals = async () => {
    setLoading(true);
    try {
      const [tenantsRes, manualsRes] = await Promise.all([
        supabase.from('fec_tenants').select('id, name, email').order('name'),
        supabase.from('manual_metadata').select('manual_id, canonical_title, platform').order('canonical_title')
      ]);

      if (tenantsRes.error) throw tenantsRes.error;
      if (manualsRes.error) throw manualsRes.error;

      setTenants(tenantsRes.data || []);
      setManuals(manualsRes.data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantAccess = async (tenantId: string) => {
    try {
      const { data, error } = await supabase
        .from('tenant_manual_access')
        .select('manual_id')
        .eq('fec_tenant_id', tenantId);

      if (error) throw error;

      const accessMap: TenantAccess = {};
      manuals.forEach(m => {
        accessMap[m.manual_id] = data?.some(a => a.manual_id === m.manual_id) || false;
      });
      setTenantAccess(accessMap);
    } catch (error: any) {
      toast({
        title: 'Error loading tenant access',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const toggleManualAccess = (manualId: string) => {
    setTenantAccess(prev => ({
      ...prev,
      [manualId]: !prev[manualId]
    }));
  };

  const selectAllManuals = () => {
    const allSelected: TenantAccess = {};
    manuals.forEach(m => {
      allSelected[m.manual_id] = true;
    });
    setTenantAccess(allSelected);
  };

  const deselectAllManuals = () => {
    const allDeselected: TenantAccess = {};
    manuals.forEach(m => {
      allDeselected[m.manual_id] = false;
    });
    setTenantAccess(allDeselected);
  };

  const saveChanges = async () => {
    if (!selectedTenant) return;

    setSaving(true);
    try {
      // Get current access
      const { data: currentAccess } = await supabase
        .from('tenant_manual_access')
        .select('manual_id')
        .eq('fec_tenant_id', selectedTenant);

      const currentManualIds = new Set(currentAccess?.map(a => a.manual_id) || []);
      const newManualIds = new Set(
        Object.entries(tenantAccess)
          .filter(([_, hasAccess]) => hasAccess)
          .map(([manualId]) => manualId)
      );

      // Delete removed access
      const toRemove = Array.from(currentManualIds).filter(id => !newManualIds.has(id));
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('tenant_manual_access')
          .delete()
          .eq('fec_tenant_id', selectedTenant)
          .in('manual_id', toRemove);
        if (error) throw error;
      }

      // Add new access
      const toAdd = Array.from(newManualIds).filter(id => !currentManualIds.has(id));
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('tenant_manual_access')
          .insert(
            toAdd.map(manual_id => ({
              fec_tenant_id: selectedTenant,
              manual_id
            }))
          );
        if (error) throw error;
      }

      toast({
        title: 'Changes saved',
        description: 'Tenant manual access updated successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error saving changes',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Tenant & User Management" />
      <div className="container mx-auto p-6 space-y-6">
        <Tabs defaultValue="tenants" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="tenants">Tenant Manual Access</TabsTrigger>
            <TabsTrigger value="users">User Access Levels</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tenants">
            <Card className="border-l-4 border-l-orange/50">
              <CardHeader>
                <CardTitle className="text-orange">Tenant Manual Access Management</CardTitle>
                <CardDescription>
                  Assign which manuals each tenant can access
                </CardDescription>
              </CardHeader>
              <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Tenant List */}
              <div className="space-y-2">
                <h3 className="font-semibold mb-4 text-orange">Select Tenant</h3>
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {tenants.map(tenant => (
                    <Button
                      key={tenant.id}
                      variant={selectedTenant === tenant.id ? 'orange' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => setSelectedTenant(tenant.id)}
                    >
                      <div className="text-left overflow-hidden">
                        <div className="font-medium truncate">{tenant.name}</div>
                        <div className="text-xs opacity-70 truncate">{tenant.email}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Manual Access List */}
              <div className="md:col-span-2">
                {selectedTenant ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-orange">Manual Access</h3>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={selectAllManuals}
                        >
                          Select All
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={deselectAllManuals}
                        >
                          Deselect All
                        </Button>
                        <Button onClick={saveChanges} disabled={saving} variant="orange">
                          {saving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                      {manuals.map(manual => (
                        <div
                          key={manual.manual_id}
                          className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <Checkbox
                            id={manual.manual_id}
                            checked={tenantAccess[manual.manual_id] || false}
                            onCheckedChange={() => toggleManualAccess(manual.manual_id)}
                          />
                          <label
                            htmlFor={manual.manual_id}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium">{manual.canonical_title}</div>
                            {manual.platform && (
                              <div className="text-xs text-muted-foreground">{manual.platform}</div>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[600px] text-muted-foreground">
                    Select a tenant to manage their manual access
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="users">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              User Access Management
            </CardTitle>
            <CardDescription>
              Manage user access levels and grant manual overrides for full access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
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
      </TabsContent>
    </Tabs>
    
    {/* Edit User Access Dialog */}
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
          <Button onClick={handleSaveAccess} disabled={userSaving}>
            {userSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      </div>
    </div>
  );
}
