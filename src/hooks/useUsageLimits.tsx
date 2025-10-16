import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UsageLimits {
  id: string;
  fec_tenant_id: string;
  queries_per_month: number;
  queries_used_this_month: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export const useUsageLimits = () => {
  const { data: usageLimits, isLoading, error, refetch } = useQuery({
    queryKey: ['usage-limits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usage_limits')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as UsageLimits;
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const isLimitReached = usageLimits 
    ? usageLimits.queries_used_this_month >= usageLimits.queries_per_month 
    : false;

  const remainingQueries = usageLimits
    ? Math.max(0, usageLimits.queries_per_month - usageLimits.queries_used_this_month)
    : 0;

  const usagePercentage = usageLimits
    ? Math.min(100, (usageLimits.queries_used_this_month / usageLimits.queries_per_month) * 100)
    : 0;

  return {
    usageLimits,
    isLoading,
    error,
    refetch,
    isLimitReached,
    remainingQueries,
    usagePercentage,
  };
};
