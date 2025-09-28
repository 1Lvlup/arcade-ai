import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AIConfig {
  id: string;
  config_key: string;
  config_value: any;
  description: string;
}

export const useAIConfig = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: aiConfigs, isLoading, error } = useQuery({
    queryKey: ['ai-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .order('config_key');
      
      if (error) {
        console.error('Failed to fetch AI config:', error);
        throw error;
      }
      return data as AIConfig[];
    },
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from('ai_config')
        .upsert({ 
          config_key: key, 
          config_value: value 
        }, {
          onConflict: 'config_key'
        });
      
      if (error) {
        console.error('Failed to update config:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      toast({ title: 'Configuration updated successfully' });
    },
    onError: (error) => {
      console.error('Failed to update config:', error);
      toast({ 
        title: 'Update failed', 
        description: 'Failed to update AI configuration',
        variant: 'destructive' 
      });
    }
  });

  const getConfigValue = (key: string, defaultValue: any = '') => {
    const config = aiConfigs?.find(c => c.config_key === key);
    return config?.config_value ?? defaultValue;
  };

  const updateConfig = (key: string, value: any) => {
    updateConfigMutation.mutate({ key, value });
  };

  return {
    aiConfigs,
    isLoading,
    error,
    updateConfig,
    getConfigValue,
    isUpdating: updateConfigMutation.isPending,
  };
};