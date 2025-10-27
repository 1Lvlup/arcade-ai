import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Subscription tier mapping
export const SUBSCRIPTION_TIERS = {
  starter_monthly: {
    price_id: "price_1SMyMHKhihueLCnLcJAH2Q70",
    product_id: "prod_TJbZGUZDFTO2IK",
    name: "Starter",
    price: 149,
    oldPrice: 299,
    interval: "month" as const,
  },
  starter_annual: {
    price_id: "price_1SMyMXKhihueLCnLuCxVWoXO",
    product_id: "prod_TJbZngTkYHEsUy",
    name: "Starter",
    price: 1345,
    oldPrice: 2700,
    interval: "year" as const,
  },
  pro_monthly: {
    price_id: "price_1SMyMjKhihueLCnLNHpdYh9n",
    product_id: "prod_TJbZc5GqoMOI3p",
    name: "Pro",
    price: 249,
    oldPrice: 499,
    interval: "month" as const,
  },
  pro_annual: {
    price_id: "price_1SMyMwKhihueLCnLHWeXRvmP",
    product_id: "prod_TJbaiLiwlOCjEF",
    name: "Pro",
    price: 2245,
    oldPrice: 4500,
    interval: "year" as const,
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
