import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GamepadIcon, MessageCircle, BookOpen, Eye } from 'lucide-react';
import { ProcessingMonitor } from '@/components/ProcessingMonitor';
import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';
import { Link } from 'react-router-dom';

const Index = () => {
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string>();
  const [selectedManualTitle, setSelectedManualTitle] = useState<string>();

  useEffect(() => {
    // Check URL parameters for chat mode
    const urlParams = new URLSearchParams(window.location.search);
    const chatMode = urlParams.get('chat');
    const manualId = urlParams.get('manual_id');
    const title = urlParams.get('title');
    
    if (chatMode === 'true') {
      setShowChat(true);
      if (manualId) {
        setSelectedManualId(manualId);
        setSelectedManualTitle(title || undefined);
      }
    }
  }, []);


  const handleStartGeneralChat = () => {
    setSelectedManualId(undefined);
    setSelectedManualTitle(undefined);
    setShowChat(true);
    // Update URL without manual-specific parameters
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('chat', 'true');
    newUrl.searchParams.delete('manual_id');
    newUrl.searchParams.delete('title');
    window.history.pushState({}, '', newUrl.toString());
  };

  const handleBackToHome = () => {
    setShowChat(false);
    setSelectedManualId(undefined);
    setSelectedManualTitle(undefined);
    // Clear URL parameters
    const newUrl = new URL(window.location.href);
    newUrl.search = '';
    window.history.pushState({}, '', newUrl.toString());
  };

  if (showChat) {
    return (
      <div className="min-h-screen arcade-bg">
        <SharedHeader 
          title={selectedManualId ? `Chat: ${selectedManualTitle}` : 'General Chat'}
          showBackButton={true}
          backTo="/"
        />
        <main className="container mx-auto px-4 py-8">
          <ChatBot 
            selectedManualId={selectedManualId}
            manualTitle={selectedManualTitle}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen arcade-bg">
      <SharedHeader title="Arcade Fix Guru" />

      <main className="container mx-auto px-4 py-8">
        <div className="text-center space-y-6 mb-12">
          <h2 className="text-4xl font-bold neon-text">Welcome to Your FEC Portal</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered troubleshooting for arcade games and bowling lanes. 
            Get instant fixes, parts info, and escalation scripts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <span>AI Assistant</span>
              </CardTitle>
              <CardDescription>
                Get instant help with troubleshooting questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartGeneralChat} className="w-full">
                Start General Chat
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <span>Manual Management</span>
              </CardTitle>
              <CardDescription>
                Upload and manage your arcade game manuals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/manuals">
                <Button variant="outline" className="w-full">
                  Manage Manuals
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="h-5 w-5 text-primary" />
                <span>Vision Board</span>
              </CardTitle>
              <CardDescription>
                Strategic planning and insights dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/vision-board">
                <Button variant="outline" className="w-full">
                  View Board
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <ProcessingMonitor />
      </main>
    </div>
  );
};

export default Index;