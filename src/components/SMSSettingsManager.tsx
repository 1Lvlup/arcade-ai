import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Plus, X, MessageSquare } from 'lucide-react';
import { useAdminCheck } from '@/hooks/useAdminCheck';

interface SMSConfig {
  id: string;
  welcome_message_enabled: boolean;
  welcome_message_template: string;
  example_questions: string[];
  auto_send_on_first_message: boolean;
}

export function SMSSettingsManager() {
  const { isAdmin } = useAdminCheck();
  const [config, setConfig] = useState<SMSConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newExample, setNewExample] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_config')
        .select('*')
        .single();

      if (error) throw error;
      setConfig(data);
    } catch (error: any) {
      console.error('Error loading SMS config:', error);
      toast.error('Failed to load SMS settings');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sms_config')
        .update({
          welcome_message_enabled: config.welcome_message_enabled,
          welcome_message_template: config.welcome_message_template,
          example_questions: config.example_questions,
          auto_send_on_first_message: config.auto_send_on_first_message,
        })
        .eq('id', config.id);

      if (error) throw error;
      toast.success('SMS settings saved successfully');
    } catch (error: any) {
      console.error('Error saving SMS config:', error);
      toast.error('Failed to save SMS settings');
    } finally {
      setSaving(false);
    }
  };

  const addExample = () => {
    if (!config || !newExample.trim()) return;
    
    setConfig({
      ...config,
      example_questions: [...config.example_questions, newExample.trim()]
    });
    setNewExample('');
  };

  const removeExample = (index: number) => {
    if (!config) return;
    
    setConfig({
      ...config,
      example_questions: config.example_questions.filter((_, i) => i !== index)
    });
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Admin access required</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No SMS configuration found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Onboarding Settings
          </CardTitle>
          <CardDescription>
            Configure automatic welcome messages and onboarding for SMS users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Welcome Message Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Welcome Messages</Label>
              <p className="text-sm text-muted-foreground">
                Send welcome message to new SMS users
              </p>
            </div>
            <Switch
              checked={config.welcome_message_enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, welcome_message_enabled: checked })
              }
            />
          </div>

          {/* Auto-send Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-send on First Message</Label>
              <p className="text-sm text-muted-foreground">
                Automatically send welcome when user texts for the first time
              </p>
            </div>
            <Switch
              checked={config.auto_send_on_first_message}
              onCheckedChange={(checked) =>
                setConfig({ ...config, auto_send_on_first_message: checked })
              }
            />
          </div>

          {/* Welcome Message Template */}
          <div className="space-y-2">
            <Label>Welcome Message Template</Label>
            <Textarea
              value={config.welcome_message_template}
              onChange={(e) =>
                setConfig({ ...config, welcome_message_template: e.target.value })
              }
              rows={8}
              className="font-mono text-sm"
              placeholder="Enter welcome message template..."
            />
            <p className="text-xs text-muted-foreground">
              Character count: {config.welcome_message_template.length} (SMS limit: 160 per segment)
            </p>
          </div>

          {/* Example Questions */}
          <div className="space-y-3">
            <Label>Example Questions</Label>
            <div className="space-y-2">
              {config.example_questions.map((example, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input value={example} readOnly className="flex-1" />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeExample(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                placeholder="Add new example question..."
                onKeyDown={(e) => e.key === 'Enter' && addExample()}
              />
              <Button onClick={addExample} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Message Preview</Label>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap font-mono">
                {config.welcome_message_template}
              </p>
            </div>
          </div>

          {/* Save Button */}
          <Button onClick={saveConfig} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save SMS Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
