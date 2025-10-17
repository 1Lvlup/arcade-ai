import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';

const Chat = () => {
  return (
    <div className="min-h-screen mesh-gradient flex flex-col">
      <SharedHeader title="AI Assistant" showBackButton={true} />
      
      <main className="flex-1 container mx-auto px-4 py-4 flex flex-col">
        <div className="flex-1 min-h-0">
          <ChatBot />
        </div>
      </main>
    </div>
  );
};

export default Chat;
