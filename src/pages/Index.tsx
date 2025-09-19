import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GamepadIcon, Zap, LogOut, MessageCircle, ArrowLeft } from 'lucide-react';
import { ManualUpload } from '@/components/ManualUpload';
import { ManualsList } from '@/components/ManualsList';
import { ProcessingMonitor } from '@/components/ProcessingMonitor';
import { ChatBot } from '@/components/ChatBot';
import { Link } from 'react-router-dom';

const Index = () => {
  const { user, signOut } = useAuth();
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

  const handleSignOut = async () => {
    await signOut();
  };

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
        <header className="border-b border-primary/20 bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToHome}
                className="hover:bg-primary/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div className="flex items-center space-x-2">
                <GamepadIcon className="h-6 w-6 text-primary neon-glow" />
                <Zap className="h-4 w-4 text-secondary" />
                <h1 className="text-xl font-bold neon-text">
                  {selectedManualId ? `Chat: ${selectedManualTitle}` : 'General Chat'}
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="border-primary/30 hover:border-primary"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

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
      <header className="border-b border-primary/20 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GamepadIcon className="h-6 w-6 text-primary neon-glow" />
            <Zap className="h-4 w-4 text-secondary" />
            <h1 className="text-xl font-bold neon-text">Arcade Fix Guru</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="border-primary/30 hover:border-primary"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="text-center space-y-6 mb-12">
          <h2 className="text-4xl font-bold neon-text">Welcome to Your FEC Portal</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered troubleshooting for arcade games and bowling lanes. 
            Get instant fixes, parts info, and escalation scripts.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Quick Actions */}
          <div className="space-y-6">
            <Card className="border-primary/20 neon-glow hover:border-primary/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <span>AI Assistant</span>
                </CardTitle>
                <CardDescription>
                  Chat with AI for instant troubleshooting across all your manuals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full neon-glow"
                  onClick={handleStartGeneralChat}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Start General Chat
                </Button>
              </CardContent>
            </Card>

            <Card className="border-accent/20 hover:border-accent/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span className="text-accent">📚</span>
                  <span>Manual Management</span>
                </CardTitle>
                <CardDescription>
                  Upload and manage game manuals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full border-accent/30 hover:border-accent" asChild>
                  <Link to="/manuals">Manage Manuals</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-secondary/20 hover:border-secondary/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <GamepadIcon className="h-5 w-5 text-secondary" />
                  <span>Vision Board</span>
                </CardTitle>
                <CardDescription>
                  Product roadmap and feature ideas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" className="w-full" asChild>
                  <Link to="/vision">View Vision Board</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Manuals & Upload */}
          <div className="space-y-6">
            <ManualUpload />
            <ManualsList />
          </div>
        </div>

        {/* Processing Monitor */}
        <ProcessingMonitor />
      </main>
    </div>
  );
};

export default Index;