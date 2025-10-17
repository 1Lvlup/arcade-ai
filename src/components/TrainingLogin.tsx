import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';
import { useTrainingAuth } from '@/hooks/useTrainingAuth';
import { useToast } from '@/hooks/use-toast';

export function TrainingLogin() {
  const [key, setKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useTrainingAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!key.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an admin key',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Test the key by making a request to the inbox
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/training-inbox?limit=1`,
        {
          headers: {
            'x-admin-key': key,
          },
        }
      );

      if (response.ok) {
        login(key);
        toast({
          title: 'Success',
          description: 'Admin authentication successful',
        });
        navigate('/training-hub');
      } else {
        toast({
          title: 'Authentication Failed',
          description: 'Invalid admin key',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: 'Failed to authenticate. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">Training Hub Access</CardTitle>
            <CardDescription className="mt-2">
              Enter your admin key to access the Training Hub
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminKey">Admin Key</Label>
              <Input
                id="adminKey"
                type="password"
                placeholder="Enter your admin key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Authenticating...' : 'Access Training Hub'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
