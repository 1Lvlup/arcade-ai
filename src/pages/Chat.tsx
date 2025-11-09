import { useState, useEffect } from 'react';
import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';
import { UsageBanner } from '@/components/UsageBanner';
import { useAuth } from '@/hooks/useAuth';
import { GameSidebar } from '@/components/GameSidebar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedManualId, setSelectedManualId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState<string | null>(null);

  const handleManualChange = (manualId: string | null, title: string | null) => {
    setSelectedManualId(manualId);
    setManualTitle(title);
  };

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
    <div className="h-screen bg-black flex flex-col w-full overflow-hidden">
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
      <div className="flex-1 min-h-0 w-full">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
            <GameSidebar 
              selectedManualId={selectedManualId}
              onManualChange={handleManualChange}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={80}>
            <ChatBot 
              key={refreshTrigger}
              selectedManualId={selectedManualId}
              manualTitle={manualTitle}
              onUsageUpdate={setUsageInfo}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Chat;
