import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rating: string, feedbackText: string, expectedAnswer?: string) => void;
}

export function FeedbackDialog({ open, onOpenChange, onSubmit }: FeedbackDialogProps) {
  const [rating, setRating] = useState<string>('good');
  const [feedbackText, setFeedbackText] = useState('');
  const [expectedAnswer, setExpectedAnswer] = useState('');

  const handleSubmit = () => {
    onSubmit(rating, feedbackText, expectedAnswer || undefined);
    setRating('good');
    setFeedbackText('');
    setExpectedAnswer('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Provide Feedback</DialogTitle>
          <DialogDescription>
            Help us improve the model by rating this response and providing additional context
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Rating</Label>
            <RadioGroup value={rating} onValueChange={setRating} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excellent" id="excellent" />
                <Label htmlFor="excellent">Excellent - Perfect answer</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="good" id="good" />
                <Label htmlFor="good">Good - Helpful with minor issues</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="poor" id="poor" />
                <Label htmlFor="poor">Poor - Partially helpful</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="terrible" id="terrible" />
                <Label htmlFor="terrible">Terrible - Not helpful</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Additional Feedback (Optional)</Label>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="What could be improved?"
              className="mt-2 min-h-[100px]"
            />
          </div>

          <div>
            <Label>Expected Answer (Optional)</Label>
            <Textarea
              value={expectedAnswer}
              onChange={(e) => setExpectedAnswer(e.target.value)}
              placeholder="What answer would you have expected?"
              className="mt-2 min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
