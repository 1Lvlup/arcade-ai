import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface DetailedFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queryLogId?: string;
  manualId?: string;
  queryText?: string;
}

const ISSUE_TYPES = [
  { value: 'pagination', label: 'Pagination Error', description: 'Wrong or impossible page numbers' },
  { value: 'cross_manual', label: 'Cross-Manual Contamination', description: 'Results from wrong manual' },
  { value: 'image_duplicate', label: 'Duplicate Images', description: 'Same image repeated multiple times' },
  { value: 'inference', label: 'Inference Without Disclosure', description: 'AI guessed without stating so' },
  { value: 'missing_info', label: 'Missing Information', description: 'Answer incomplete or lacks details' },
  { value: 'incorrect_info', label: 'Incorrect Information', description: 'Answer is factually wrong' },
  { value: 'other', label: 'Other Issue', description: 'Something else' },
];

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', emoji: '😐', color: 'bg-blue-500' },
  { value: 'medium', label: 'Medium', emoji: '😟', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', emoji: '😧', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', emoji: '🚨', color: 'bg-red-500' },
];

export function DetailedFeedbackDialog({ 
  open, 
  onOpenChange, 
  queryLogId, 
  manualId, 
  queryText 
}: DetailedFeedbackDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [issueType, setIssueType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [reportedPages, setReportedPages] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [severity, setSeverity] = useState<string>('medium');

  const resetForm = () => {
    setIssueType('');
    setDescription('');
    setReportedPages('');
    setExpectedBehavior('');
    setActualBehavior('');
    setSeverity('medium');
  };

  const handleSubmit = async () => {
    if (!issueType || !description) {
      toast({
        title: 'Missing Information',
        description: 'Please select an issue type and provide a description.',
        variant: 'destructive',
      });
      return;
    }

    if (description.length < 10) {
      toast({
        title: 'Description Too Short',
        description: 'Please provide at least 10 characters in your description.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user and tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Parse reported pages into array
      const pagesArray = reportedPages
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      // Submit feedback
      const { data, error } = await supabase
        .from('query_feedback')
        .insert({
          query_log_id: queryLogId,
          issue_type: issueType,
          description: description.trim(),
          reported_pages: pagesArray.length > 0 ? pagesArray : null,
          expected_behavior: expectedBehavior.trim() || null,
          actual_behavior: actualBehavior.trim() || null,
          severity,
          manual_id: manualId,
          query_text: queryText,
          fec_tenant_id: profile.fec_tenant_id,
          reported_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Feedback Submitted',
        description: `Thank you! Your feedback has been recorded (ID: ${data.id.substring(0, 8)}...)`,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'Failed to submit feedback',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedIssue = ISSUE_TYPES.find(t => t.value === issueType);
  const selectedSeverity = SEVERITY_OPTIONS.find(s => s.value === severity);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Help us improve the system by reporting problems with the AI's response.
            All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Issue Type */}
          <div className="space-y-2">
            <Label htmlFor="issue-type">
              Issue Type <span className="text-red-500">*</span>
            </Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger id="issue-type">
                <SelectValue placeholder="Select the type of issue..." />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedIssue && (
              <p className="text-sm text-muted-foreground">
                {selectedIssue.description}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail. What went wrong?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters (minimum 10)
            </p>
          </div>

          {/* Problematic Pages */}
          <div className="space-y-2">
            <Label htmlFor="pages">
              Problematic Pages <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="pages"
              placeholder="e.g., p68, p779, p35"
              value={reportedPages}
              onChange={(e) => setReportedPages(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              List any incorrect or impossible page numbers, separated by commas
            </p>
          </div>

          {/* Expected vs Actual Behavior */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expected">
                Expected Behavior <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="expected"
                placeholder="What did you expect to see?"
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actual">
                Actual Behavior <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="actual"
                placeholder="What did you actually see?"
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label>Severity</Label>
            <div className="flex gap-2">
              {SEVERITY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={severity === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSeverity(option.value)}
                  className="flex-1"
                >
                  <span className="mr-1">{option.emoji}</span>
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Context Info */}
          {(manualId || queryText) && (
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Context</p>
              {manualId && (
                <p className="text-sm">
                  <span className="font-medium">Manual:</span> {manualId}
                </p>
              )}
              {queryText && (
                <p className="text-sm">
                  <span className="font-medium">Query:</span> {queryText.substring(0, 100)}
                  {queryText.length > 100 && '...'}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !issueType || !description}
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
