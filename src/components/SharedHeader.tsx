import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Brain, LogOut, ArrowLeft, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SharedHeaderProps {
  title: string;
  showBackButton?: boolean;
  backTo?: string;
  onBackClick?: () => void;
}

export const SharedHeader = ({ title, showBackButton = false, backTo = "/", onBackClick }: SharedHeaderProps) => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {showBackButton && (
            onBackClick ? (
              <Button variant="minimal" size="sm" onClick={onBackClick}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            ) : (
              <Link to={backTo}>
                <Button variant="minimal" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
            )
          )}
          <div className="flex items-center space-x-3">
            <Brain className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground font-medium">
            {user?.email}
          </span>
          <Link to="/ai-config">
            <Button variant="minimal" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              AI Config
            </Button>
          </Link>
          <Button
            variant="minimal"
            size="sm"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};