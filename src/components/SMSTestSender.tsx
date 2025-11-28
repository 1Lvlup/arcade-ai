import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import { useAdminCheck } from '@/hooks/useAdminCheck';

export function SMSTestSender() {
  const { isAdmin } = useAdminCheck();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<{ to: string; sid: string } | null>(null);

  const handleSendTest = async () => {
    if (!phoneNumber || !message) {
      toast.error('Please fill in all fields');
      return;
    }

    // Basic phone validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      toast.error('Invalid phone number format. Use E.164 format (e.g., +1234567890)');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-sms', {
        body: {
          to: phoneNumber,
          message: message,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Test SMS sent successfully!', {
          description: `Message SID: ${data.messageSid}`,
        });
        setLastSent({ to: phoneNumber, sid: data.messageSid });
        // Clear form
        setPhoneNumber('');
        setMessage('');
      } else {
        throw new Error(data?.error || 'Failed to send SMS');
      }
    } catch (error: any) {
      console.error('Error sending test SMS:', error);
      toast.error('Failed to send test SMS', {
        description: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Admin access required</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Send Test SMS
        </CardTitle>
        <CardDescription>
          Send a test message to verify your Twilio configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            type="tel"
            placeholder="+12345678900"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={sending}
          />
          <p className="text-xs text-muted-foreground">
            Use E.164 format with country code (e.g., +1 for US)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            placeholder="Enter your test message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            disabled={sending}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Character count: {message.length} (SMS limit: 160 per segment)
          </p>
        </div>

        <Button 
          onClick={handleSendTest} 
          disabled={sending || !phoneNumber || !message}
          className="w-full"
        >
          {sending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Test SMS
            </>
          )}
        </Button>

        {lastSent && (
          <div className="mt-4 p-3 bg-muted rounded-lg flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Last message sent successfully</p>
              <p className="text-xs text-muted-foreground">To: {lastSent.to}</p>
              <p className="text-xs text-muted-foreground">Message SID: {lastSent.sid}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
