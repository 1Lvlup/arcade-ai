import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function GameRequestDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [facilityName, setFacilityName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [gameNames, setGameNames] = useState(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const addGameField = () => {
    setGameNames([...gameNames, '']);
  };

  const removeGameField = (index: number) => {
    if (gameNames.length > 1) {
      setGameNames(gameNames.filter((_, i) => i !== index));
    }
  };

  const updateGameName = (index: number, value: string) => {
    const updated = [...gameNames];
    updated[index] = value;
    setGameNames(updated);
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!facilityName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter your facility name.',
        variant: 'destructive',
      });
      return;
    }

    if (!date) {
      toast({
        title: 'Missing Information',
        description: 'Please select a date.',
        variant: 'destructive',
      });
      return;
    }

    const validGames = gameNames.filter(name => name.trim());
    if (validGames.length === 0) {
      toast({
        title: 'Missing Information',
        description: 'Please enter at least one game name.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert game request into database
      const { error } = await supabase
        .from('game_requests')
        .insert({
          facility_name: facilityName.trim(),
          request_date: date,
          game_names: validGames,
          user_id: user?.id || null,
        });

      if (error) throw error;

      toast({
        title: 'Request Submitted',
        description: `Your request for ${validGames.length} game${validGames.length > 1 ? 's' : ''} has been submitted successfully.`,
      });

      // Reset form
      setFacilityName('');
      setDate(new Date().toISOString().split('T')[0]);
      setGameNames(['']);
      setOpen(false);
    } catch (error) {
      console.error('Error submitting game request:', error);
      toast({
        title: 'Submission Failed',
        description: 'There was an error submitting your request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
            title="Request games to be added"
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="text-xs">Request Games</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Games to be Added</DialogTitle>
          <DialogDescription>
            Tell us which games you'd like to see added to our system.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="facility">Facility Name *</Label>
            <Input
              id="facility"
              placeholder="Enter your facility name"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Game Names *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addGameField}
                className="h-7"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Game
              </Button>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {gameNames.map((name, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Game ${index + 1}`}
                    value={name}
                    onChange={(e) => updateGameName(index, e.target.value)}
                  />
                  {gameNames.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGameField(index)}
                      className="h-10 px-3"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>Submitting...</>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
