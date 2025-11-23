import { useState } from 'react';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, CheckCircle2 } from 'lucide-react';

export default function SMSOptIn() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const validateAndFormatPhone = (phone: string): { valid: boolean; formatted: string; error: string } => {
    if (!phone.trim()) {
      return { valid: false, formatted: "", error: "Phone number is required" };
    }

    let cleaned = phone.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('+')) {
      const digitsOnly = cleaned.substring(1);
      if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return { valid: true, formatted: cleaned, error: "" };
      }
      return { 
        valid: false, 
        formatted: phone, 
        error: "Please use format: +1 followed by 10 digits" 
      };
    }
    
    const digitsOnly = cleaned.replace(/\D/g, '');
    
    if (digitsOnly.length === 10) {
      return { valid: true, formatted: `+1${digitsOnly}`, error: "" };
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return { valid: true, formatted: `+${digitsOnly}`, error: "" };
    } else {
      return { 
        valid: false, 
        formatted: phone, 
        error: "Please enter a valid US phone number (10 digits)" 
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!consent) {
      toast({
        title: 'Consent Required',
        description: 'Please agree to receive SMS messages',
        variant: 'destructive',
      });
      return;
    }

    const validation = validateAndFormatPhone(phoneNumber);
    if (!validation.valid) {
      setPhoneError(validation.error);
      return;
    }
    setPhoneError("");

    setLoading(true);

    try {
      // Check if user exists with this phone number
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('phone_number', validation.formatted)
        .single();

      if (existingProfile) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update({
            sms_opt_in: true,
            sms_opt_in_date: new Date().toISOString(),
          })
          .eq('phone_number', validation.formatted);

        if (error) throw error;
      } else {
        // For new opt-ins without existing account, we could create a lead record
        // or just show success message encouraging them to sign up
        toast({
          title: 'Account Required',
          description: 'Please sign up for an account to enable SMS notifications',
        });
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast({
        title: 'Success!',
        description: `SMS notifications enabled for ${validation.formatted}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to enable SMS notifications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black">
        <SharedHeader title="SMS Opt-In" showBackButton={false} />
        
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                </div>
                <h2 className="text-2xl font-tech text-white">You're All Set!</h2>
                <p className="text-muted-foreground">
                  SMS notifications have been enabled for {phoneNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  You can now text questions to our AI assistant at any time.
                  Reply STOP to opt-out at any time.
                </p>
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="bg-orange hover:bg-orange/80 text-white font-tech"
                >
                  GO TO DASHBOARD
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <SharedHeader title="SMS Opt-In" showBackButton={false} />
      
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tech text-white text-2xl">
              <MessageSquare className="h-6 w-6 text-orange" />
              ENABLE SMS SUPPORT
            </CardTitle>
            <CardDescription className="text-muted-foreground text-base">
              Get instant AI-powered troubleshooting help via text message
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  We'll use this to link your SMS to your account
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-number" className="text-white">Phone Number</Label>
                <Input
                  id="phone-number"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setPhoneError("");
                  }}
                  placeholder="+1 (555) 123-4567"
                  className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground ${
                    phoneError ? 'border-red-500' : ''
                  }`}
                  required
                />
                {phoneError ? (
                  <p className="text-xs text-red-500">{phoneError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    US phone number (will be formatted to +1...)
                  </p>
                )}
              </div>

              <div className="flex items-start space-x-3 space-y-0 rounded-md border border-white/10 p-4 bg-white/5">
                <Checkbox
                  id="sms-consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(checked as boolean)}
                  className="mt-1"
                />
                <div className="space-y-1 leading-none">
                  <Label
                    htmlFor="sms-consent"
                    className="text-sm font-medium leading-none text-white cursor-pointer"
                  >
                    I agree to receive SMS messages from Level Up AI
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    By checking this box, you consent to receive text messages from Level Up AI 
                    for troubleshooting support. Message and data rates may apply. 
                    You can reply STOP to opt-out at any time, or START to opt back in.
                  </p>
                </div>
              </div>

              <div className="bg-white/5 p-4 rounded-md border border-white/10 space-y-2">
                <h3 className="text-sm font-medium text-white">What you'll get:</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 24/7 AI-powered troubleshooting assistance</li>
                  <li>• Instant answers to arcade game technical issues</li>
                  <li>• Step-by-step repair guidance</li>
                  <li>• Access to our complete game manual database</li>
                </ul>
              </div>

              <Button 
                type="submit" 
                disabled={loading || !consent}
                className="w-full bg-orange hover:bg-orange/80 text-white font-tech text-lg py-6"
              >
                {loading ? 'ENABLING...' : 'ENABLE SMS SUPPORT'}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Already have an account?{' '}
                <a href="/auth" className="text-orange hover:underline">
                  Sign in
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
