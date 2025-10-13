import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Settings, Download, Upload, Save, TestTube } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { SharedHeader } from '@/components/SharedHeader';

interface AIConfig {
  id: string;
  config_key: string;
  config_value: any;
  description: string;
}

const AI_MODELS = {
  chat: [
    { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Most Capable)' },
    { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini (Fast & Efficient)' },
    { value: 'gpt-5-nano-2025-08-07', label: 'GPT-5 Nano (Fastest)' },
    { value: 'gpt-4o', label: 'GPT-4o (Legacy)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Legacy)' }
  ],
  embeddings: [
    { value: 'text-embedding-3-small', label: 'Text Embedding 3 Small (Recommended)' }
  ]
};

export default function AIConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testPrompt, setTestPrompt] = useState('How do I troubleshoot power issues?');
  const [testResponse, setTestResponse] = useState('');
  const [isTestingPrompt, setIsTestingPrompt] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch AI configuration
  const { data: aiConfigs, isLoading } = useQuery({
    queryKey: ['ai-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .order('config_key');
      
      if (error) throw error;
      return data as AIConfig[];
    }
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (changes: Record<string, any>) => {
      // Update all pending changes
      for (const [key, value] of Object.entries(changes)) {
        const { error } = await supabase
          .from('ai_config')
          .update({ config_value: value })
          .eq('config_key', key);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      setPendingChanges({});
      setHasUnsavedChanges(false);
      toast({ title: 'Configuration saved successfully' });
    },
    onError: (error) => {
      console.error('Failed to update config:', error);
      toast({ 
        title: 'Save failed', 
        description: 'Failed to save configuration',
        variant: 'destructive' 
      });
    }
  });

  // Test prompt mutation
  const testPromptMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: {
          messages: [{ role: 'user', content: prompt }],
          manual_id: null
        }
      });

      if (error) throw error;
      return data.answer;
    },
    onSuccess: (response) => {
      setTestResponse(response);
      toast({ title: 'Test completed successfully' });
    },
    onError: (error) => {
      console.error('Test failed:', error);
      toast({ 
        title: 'Test failed', 
        description: 'Failed to test prompt',
        variant: 'destructive' 
      });
    }
  });

  const handleConfigChange = (key: string, value: any) => {
    setPendingChanges(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = () => {
    updateConfigMutation.mutate(pendingChanges);
  };

  const handleTestPrompt = () => {
    setIsTestingPrompt(true);
    testPromptMutation.mutate(testPrompt);
    setTimeout(() => setIsTestingPrompt(false), 2000);
  };

  const exportConfig = () => {
    if (!aiConfigs) return;
    
    const exportData = aiConfigs.reduce((acc, config) => {
      acc[config.config_key] = config.config_value;
      return acc;
    }, {} as Record<string, any>);

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getConfigValue = (key: string, defaultValue: any = '') => {
    // Check pending changes first
    if (key in pendingChanges) {
      return pendingChanges[key];
    }
    
    const config = aiConfigs?.find(c => c.config_key === key);
    if (!config) return defaultValue;
    
    // Handle both JSON-stringified values and plain values
    const value = config.config_value;
    if (typeof value === 'string') {
      try {
        // Try to parse as JSON first
        return JSON.parse(value);
      } catch {
        // If parsing fails, return the raw string
        return value;
      }
    }
    return value || defaultValue;
  };

  if (isLoading) {
  return (
    <div className="min-h-screen bg-background">
      <SharedHeader 
        title="AI Configuration" 
        showBackButton={true}
        backTo="/manuals"
      />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">Loading AI configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="AI Configuration" />
      
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              AI Configuration
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your AI assistant's behavior, models, and search parameters
            </p>
          </div>
          
          <div className="flex gap-2">
            {hasUnsavedChanges && (
              <Button 
                onClick={handleSaveChanges}
                disabled={updateConfigMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateConfigMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
            <Button variant="outline" onClick={exportConfig}>
              <Download className="h-4 w-4 mr-2" />
              Export Config
            </Button>
          </div>
        </div>

        <Tabs defaultValue="models" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="prompt">System Prompt</TabsTrigger>
            <TabsTrigger value="search">Search Settings</TabsTrigger>
            <TabsTrigger value="test">Test Interface</TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Models Configuration</CardTitle>
                <CardDescription>
                  Select which OpenAI models to use for different purposes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="chat-model">Chat Model</Label>
                    <Select
                      value={getConfigValue('chat_model', 'gpt-5-2025-08-07')}
                      onValueChange={(value) => handleConfigChange('chat_model', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select chat model" />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.chat.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="search-model">Embedding Model</Label>
                    <Select
                      value={getConfigValue('search_model', 'text-embedding-3-small')}
                      onValueChange={(value) => handleConfigChange('search_model', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select embedding model" />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.embeddings.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      OpenAI embedding model for vector search (NOT LlamaCloud)
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">Response Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={getConfigValue('response_temperature')}
                    onChange={(e) => handleConfigChange('response_temperature', parseFloat(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Controls randomness: 0 = focused, 2 = creative
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Prompt</CardTitle>
                <CardDescription>
                  Configure how your AI assistant behaves and responds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="system-prompt">System Prompt</Label>
                  <Textarea
                    id="system-prompt"
                    className="min-h-[400px] font-mono text-sm"
                    value={getConfigValue('system_prompt', '')}
                    onChange={(e) => handleConfigChange('system_prompt', e.target.value)}
                  />
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Changes to the system prompt will affect all future AI responses. 
                    Test your changes using the Test Interface tab.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Search Parameters</CardTitle>
                <CardDescription>
                  Fine-tune how the AI searches through your manuals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vector-threshold">Vector Threshold</Label>
                    <Input
                      id="vector-threshold"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={getConfigValue('vector_threshold')}
                      onChange={(e) => handleConfigChange('vector_threshold', parseFloat(e.target.value))}
                    />
                    <p className="text-sm text-muted-foreground">
                      Minimum similarity for vector search (0.3 recommended)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="text-threshold">Text Threshold</Label>
                    <Input
                      id="text-threshold"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={getConfigValue('text_threshold')}
                      onChange={(e) => handleConfigChange('text_threshold', parseFloat(e.target.value))}
                    />
                    <p className="text-sm text-muted-foreground">
                      Minimum score for text search (0.1 recommended)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-results">Max Results</Label>
                    <Input
                      id="max-results"
                      type="number"
                      min="1"
                      max="50"
                      value={getConfigValue('max_results')}
                      onChange={(e) => handleConfigChange('max_results', parseInt(e.target.value))}
                    />
                    <p className="text-sm text-muted-foreground">
                      Maximum search results to return
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rerank-threshold">Rerank Threshold</Label>
                  <Input
                    id="rerank-threshold"
                    type="number"
                    min="1"
                    max="20"
                    value={getConfigValue('rerank_threshold')}
                    onChange={(e) => handleConfigChange('rerank_threshold', parseInt(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Minimum results before applying AI reranking (3 recommended)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Interface</CardTitle>
                <CardDescription>
                  Test your AI configuration with sample prompts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-prompt">Test Prompt</Label>
                  <Textarea
                    id="test-prompt"
                    placeholder="Enter a test question..."
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                  />
                </div>

                <Button 
                  onClick={handleTestPrompt} 
                  disabled={isTestingPrompt || testPromptMutation.isPending}
                  className="w-full"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isTestingPrompt || testPromptMutation.isPending ? 'Testing...' : 'Test Prompt'}
                </Button>

                {testResponse && (
                  <div className="space-y-2">
                    <Label>AI Response</Label>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="whitespace-pre-wrap text-sm">
                        {testResponse}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}