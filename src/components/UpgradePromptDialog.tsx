import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Zap, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queriesUsed: number;
  queriesLimit: number;
}

export const UpgradePromptDialog = ({
  open,
  onOpenChange,
  queriesUsed,
  queriesLimit,
}: UpgradePromptDialogProps) => {
  const navigate = useNavigate();
  const usagePercentage = (queriesUsed / queriesLimit) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-6 w-6 text-primary" />
            <DialogTitle className="text-xl font-tech text-foreground">You're running low on queries</DialogTitle>
          </div>
          <DialogDescription className="text-base text-muted-foreground">
            You've used {queriesUsed} of {queriesLimit} free queries this month
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Usage</span>
              <span className="text-foreground font-medium">{queriesUsed}/{queriesLimit}</span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Upgrade to Pro for unlimited support:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">300 queries per week</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Priority support</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Advanced features</span>
              </div>
            </div>
            <p className="text-lg font-bold text-primary">$99/month</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Continue with Free
          </Button>
          <Button
            variant="orange"
            onClick={() => navigate('/pricing')}
            className="w-full sm:w-auto"
          >
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
