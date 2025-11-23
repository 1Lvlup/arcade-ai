import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Subscription tier mapping
export const SUBSCRIPTION_TIERS = {
  basic_monthly: {
    price_id: "price_1SWdLQKhihueLCnL07FYJFcr",
    product_id: "prod_TTaWsTfilkHfme",
    name: "Basic",
    price: 99,
    interval: "month" as const,
  }
} as const;

interface SubscriptionData {
  subscribed: boolean;
  product_id?: string;
  subscription_end?: string;
}

export const useSubscription = () => {
  const { user } = useAuth();

  const { data: subscriptionData, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.functions.invoke<SubscriptionData>('check-subscription');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: 60000, // Refetch every minute
  });

  const getCurrentTier = () => {
    if (!subscriptionData?.subscribed || !subscriptionData.product_id) {
      return null;
    }

    // Find matching tier by product_id
    const tier = Object.entries(SUBSCRIPTION_TIERS).find(
      ([_, config]) => config.product_id === subscriptionData.product_id
    );

    return tier ? tier[0] as keyof typeof SUBSCRIPTION_TIERS : null;
  };

  const isSubscribed = subscriptionData?.subscribed || false;
  const currentTier = getCurrentTier();
  const subscriptionEnd = subscriptionData?.subscription_end;

  return {
    isSubscribed,
    currentTier,
    subscriptionEnd,
    isLoading,
    error,
    refetch,
  };
};
