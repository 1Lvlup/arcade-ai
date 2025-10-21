import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { SharedHeader } from '@/components/SharedHeader';

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

export default function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [tenantAccess, setTenantAccess] = useState<TenantAccess>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTenantsAndManuals();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetchTenantAccess(selectedTenant);
    }
  }, [selectedTenant]);

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
      <SharedHeader title="Tenant Management" />
      <div className="container mx-auto p-6 space-y-6">
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
      </div>
    </div>
  );
}
