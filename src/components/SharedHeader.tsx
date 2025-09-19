import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { GamepadIcon, Zap, LogOut, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SharedHeaderProps {
  title: string;
  showBackButton?: boolean;
  backTo?: string;
}

export const SharedHeader = ({ title, showBackButton = false, backTo = "/" }: SharedHeaderProps) => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="border-b border-primary/20 bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {showBackButton && (
            <Link to={backTo}>
              <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          )}
          <div className="flex items-center space-x-2">
            <GamepadIcon className="h-6 w-6 text-primary neon-glow" />
            <Zap className="h-4 w-4 text-secondary" />
            <h1 className="text-xl font-bold neon-text">{title}</h1>
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
  );
};