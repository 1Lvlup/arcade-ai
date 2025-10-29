import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AlertCircle, LogIn, UserPlus } from 'lucide-react';

interface UsageBannerProps {
  queriesUsed: number;
  queriesRemaining: number;
  queriesLimit: number | null;
  isAuthenticated: boolean;
  limitReached: boolean;
  signupRequired?: boolean;
}

export const UsageBanner = ({
  queriesUsed,
  queriesRemaining,
  queriesLimit,
  isAuthenticated,
  limitReached,
  signupRequired = false,
}: UsageBannerProps) => {
  if (!signupRequired && queriesRemaining > 2) {
    return null;
  }

  if (signupRequired || limitReached) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            {signupRequired ? (
              <p>You've used all {queriesLimit || 5} free questions this week. Sign up to get {isAuthenticated ? 'more' : '300 questions per week'}!</p>
            ) : (
              <p>You've reached your weekly limit of {queriesLimit} questions. This limit will reset at the start of next week.</p>
            )}
          </div>
          {signupRequired && (
            <div className="flex gap-2 ml-4">
              <Link to="/auth?tab=signin">
                <Button variant="outline" size="sm" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </Link>
              <Link to="/auth?tab=signup">
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Sign Up Free
                </Button>
              </Link>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 border-orange/50 bg-orange/5">
      <AlertCircle className="h-4 w-4 text-orange" />
      <AlertDescription className="text-foreground">
        {isAuthenticated ? (
          <p>
            You have <strong className="text-orange">{queriesRemaining}</strong> questions remaining this week.
          </p>
        ) : (
          <div className="flex items-center justify-between">
            <p>
              You have <strong className="text-orange">{queriesRemaining}</strong> free questions remaining.{' '}
              <Link to="/auth?tab=signup" className="underline text-orange hover:text-orange/80">
                Sign up
              </Link>{' '}
              to get 300 questions per week!
            </p>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};
