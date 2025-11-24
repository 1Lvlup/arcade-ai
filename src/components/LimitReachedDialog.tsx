import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Calendar } from "lucide-react";

interface LimitReachedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  resetDate?: Date;
}

export const LimitReachedDialog = ({
  open,
  onOpenChange,
  isAuthenticated,
  resetDate,
}: LimitReachedDialogProps) => {
  const navigate = useNavigate();
  
  const getResetDateString = () => {
    if (!resetDate) {
      // Default to first of next month
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <DialogTitle className="text-xl font-tech text-foreground">Query Limit Reached</DialogTitle>
          </div>
          <DialogDescription className="text-base text-muted-foreground">
            You've used all 5 free queries this month
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isAuthenticated && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>Your limit resets on {getResetDateString()}</span>
            </div>
          )}

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Upgrade to Pro to keep going:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>300 queries per week (unlimited for most users)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Priority support and response times</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Advanced diagnostics and troubleshooting</span>
              </li>
            </ul>
            <div className="pt-2 border-t border-border/50">
              <p className="text-lg font-bold text-primary">Just $99/month</p>
              <p className="text-xs text-muted-foreground">Cancel anytime</p>
            </div>
          </div>

          {!isAuthenticated && (
            <p className="text-xs text-center text-muted-foreground">
              Sign up for a free account to track your usage and get 5 queries per month
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="orange"
            onClick={() => navigate('/pricing')}
            className="w-full"
          >
            View Pricing & Upgrade
          </Button>
          {!isAuthenticated && (
            <Button
              variant="outline"
              onClick={() => navigate('/auth')}
              className="w-full"
            >
              Sign Up for Free Account
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
