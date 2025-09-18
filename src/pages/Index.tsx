import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GamepadIcon, Zap, LogOut } from 'lucide-react';

const Index = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-primary/20 neon-glow hover:border-primary/40 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-primary" />
                <span>AI Assistant</span>
              </CardTitle>
              <CardDescription>
                Chat with AI for instant troubleshooting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full neon-glow">
                Start Chat
              </Button>
            </CardContent>
          </Card>

          <Card className="border-secondary/20 hover:border-secondary/40 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GamepadIcon className="h-5 w-5 text-secondary" />
                <span>Game Dashboard</span>
              </CardTitle>
              <CardDescription>
                Monitor all games and bowling lanes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full">
                View Dashboard
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
                <a href="/manuals">Manage Manuals</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
