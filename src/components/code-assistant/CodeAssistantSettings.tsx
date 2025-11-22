import { Settings, Github, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

interface CodeAssistantSettingsProps {
  repository: string;
  branch: string;
  autoSyncInterval: number;
  onSave: (settings: { repository: string; branch: string; autoSyncInterval: number }) => void;
}

export function CodeAssistantSettings({
  repository,
  branch,
  autoSyncInterval,
  onSave,
}: CodeAssistantSettingsProps) {
  const [open, setOpen] = useState(false);
  const [localRepo, setLocalRepo] = useState(repository);
  const [localBranch, setLocalBranch] = useState(branch);
  const [localInterval, setLocalInterval] = useState(autoSyncInterval);

  const handleSave = () => {
    onSave({
      repository: localRepo,
      branch: localBranch,
      autoSyncInterval: localInterval,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Code Assistant Settings</DialogTitle>
          <DialogDescription>
            Configure GitHub repository and sync settings
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="repository">
              <Github className="h-4 w-4 inline mr-1" />
              GitHub Repository
            </Label>
            <Input
              id="repository"
              value={localRepo}
              onChange={(e) => setLocalRepo(e.target.value)}
              placeholder="owner/repo"
            />
            <p className="text-xs text-muted-foreground">
              Format: owner/repo (e.g., facebook/react)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch">Branch</Label>
            <Input
              id="branch"
              value={localBranch}
              onChange={(e) => setLocalBranch(e.target.value)}
              placeholder="main"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sync-interval">Auto-sync Interval</Label>
            <Select
              value={localInterval.toString()}
              onValueChange={(value) => setLocalInterval(parseInt(value))}
            >
              <SelectTrigger id="sync-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Manual only</SelectItem>
                <SelectItem value="300000">Every 5 minutes</SelectItem>
                <SelectItem value="900000">Every 15 minutes</SelectItem>
                <SelectItem value="1800000">Every 30 minutes</SelectItem>
                <SelectItem value="3600000">Every hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
