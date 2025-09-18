import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GamepadIcon, Zap } from 'lucide-react';

interface FecTenant {
  id: string;
  name: string;
  email: string;
}

export default function Auth() {
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fecTenants, setFecTenants] = useState<FecTenant[]>([]);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedFecId, setSelectedFecId] = useState('');
  const [newFecName, setNewFecName] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    // Fetch available FEC tenants for signup
    const fetchFecTenants = async () => {
      const { data } = await supabase
        .from('fec_tenants')
        .select('id, name, email')
        .order('name');
      if (data) {
        setFecTenants(data);
      }
    };
    fetchFecTenants();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let fecTenantId = selectedFecId;

    // If creating a new FEC, create it first
    if (!selectedFecId && newFecName) {
      const { data: newFec, error: fecError } = await supabase
        .from('fec_tenants')
        .insert([{ name: newFecName, email }])
        .select()
        .single();

      if (fecError) {
        toast({
          title: 'Failed to create FEC',
          description: fecError.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      fecTenantId = newFec.id;
    }

    if (!fecTenantId) {
      toast({
        title: 'Please select or create an FEC',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, fecTenantId);
    if (error) {
      toast({
        title: 'Sign up failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success!',
        description: 'Please check your email to confirm your account.',
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen arcade-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <GamepadIcon className="h-8 w-8 text-primary neon-glow" />
            <Zap className="h-6 w-6 text-secondary" />
          </div>
          <h1 className="text-3xl font-bold neon-text">Arcade Fix Guru</h1>
          <p className="text-muted-foreground">FEC Portal Access</p>
        </div>

        <Card className="border-primary/20 neon-glow">
          <CardHeader>
            <CardTitle className="text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              Sign in to your FEC portal or create a new account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="border-primary/30 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="border-primary/30 focus:border-primary"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full neon-glow" 
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="border-primary/30 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="border-primary/30 focus:border-primary"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>FEC (Family Entertainment Center)</Label>
                    <Select value={selectedFecId} onValueChange={setSelectedFecId}>
                      <SelectTrigger className="border-primary/30 focus:border-primary">
                        <SelectValue placeholder="Select existing FEC or create new" />
                      </SelectTrigger>
                      <SelectContent>
                        {fecTenants.map((fec) => (
                          <SelectItem key={fec.id} value={fec.id}>
                            {fec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {!selectedFecId && (
                    <div className="space-y-2">
                      <Label htmlFor="new-fec-name">Or Create New FEC</Label>
                      <Input
                        id="new-fec-name"
                        type="text"
                        value={newFecName}
                        onChange={(e) => setNewFecName(e.target.value)}
                        placeholder="Enter your FEC name"
                        className="border-primary/30 focus:border-primary"
                      />
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full neon-glow" 
                    disabled={loading}
                  >
                    {loading ? 'Creating account...' : 'Sign Up'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}