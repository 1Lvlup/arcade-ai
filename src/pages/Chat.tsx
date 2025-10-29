import { useState, useEffect } from 'react';
import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';
import { UsageBanner } from '@/components/UsageBanner';
import { useAuth } from '@/hooks/useAuth';

interface UsageInfo {
  queries_used: number;
  queries_remaining: number;
  queries_limit: number | null;
  limit_reached: boolean;
  is_authenticated: boolean;
  signup_required?: boolean;
  manual_override?: boolean;
}

const Chat = () => {
  const { user } = useAuth();
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);

  // Listen for usage updates from ChatBot
  useEffect(() => {
    const handleUsageUpdate = (event: CustomEvent<UsageInfo>) => {
      setUsageInfo(event.detail);
    };

    window.addEventListener('usage-update' as any, handleUsageUpdate);
    return () => {
      window.removeEventListener('usage-update' as any, handleUsageUpdate);
    };
  }, []);

  return (
    <div className="min-h-screen mesh-gradient flex flex-col">
      <SharedHeader title="AI Assistant" showBackButton={true} />
      
      <main className="flex-1 container mx-auto px-4 py-4 flex flex-col">
        {usageInfo && !usageInfo.manual_override && (
          <UsageBanner
            queriesUsed={usageInfo.queries_used}
            queriesRemaining={usageInfo.queries_remaining}
            queriesLimit={usageInfo.queries_limit}
            isAuthenticated={usageInfo.is_authenticated}
            limitReached={usageInfo.limit_reached}
            signupRequired={usageInfo.signup_required}
          />
        )}
        <div className="flex-1 min-h-0">
          <ChatBot onUsageUpdate={setUsageInfo} />
        </div>
      </main>
    </div>
  );
};

export default Chat;
