import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Scale, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'lawyer' | 'partner'>('lawyer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(from, { replace: true });
  }, [authLoading, isAuthenticated, navigate, from]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      // Deliberately generic: never reveal whether the account exists.
      toast({
        title: 'Sign in failed',
        description: 'Invalid email or password.',
        variant: 'destructive',
      });
      return;
    }
    navigate(from, { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({
        title: 'Weak password',
        description: 'Please use at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name, phone, role },
      },
    });
    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Could not create account',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    if (!data.session) {
      setAwaitingConfirm(true);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background legal-pattern flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <Scale className="h-10 w-10 text-primary" />
            <span className="font-serif text-2xl font-semibold text-gold-gradient">Legal Diary</span>
          </Link>
        </div>

        {awaitingConfirm ? (
          <Card className="glass-effect border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="font-serif text-2xl">Check your email</CardTitle>
              <CardDescription>
                We sent a confirmation link to {email}. Click it to activate your chambers account,
                then sign in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setAwaitingConfirm(false);
                  setMode('signin');
                }}
              >
                Back to sign in
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-effect border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="font-serif text-2xl">
                {mode === 'signin' ? 'Welcome Back' : 'Create Your Account'}
              </CardTitle>
              <CardDescription>
                {mode === 'signin'
                  ? 'Sign in to access your case diary'
                  : 'Start tracking your matters securely'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'signin' | 'signup')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
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
                        required
                        autoComplete="email"
                        placeholder="you@chambers.in"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full gold-gradient text-primary-foreground"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Sign In <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full name</Label>
                      <Input
                        id="signup-name"
                        required
                        placeholder="Adv. Sahil Chavan"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@chambers.in"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Phone</Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="+91 98XXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        required
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>I am a</Label>
                      <RadioGroup
                        value={role}
                        onValueChange={(v) => setRole(v as 'lawyer' | 'partner')}
                        className="grid grid-cols-2 gap-3"
                      >
                        <Label
                          htmlFor="role-lawyer"
                          className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3 cursor-pointer has-[:checked]:border-primary"
                        >
                          <RadioGroupItem value="lawyer" id="role-lawyer" />
                          Lawyer
                        </Label>
                        <Label
                          htmlFor="role-partner"
                          className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3 cursor-pointer has-[:checked]:border-primary"
                        >
                          <RadioGroupItem value="partner" id="role-partner" />
                          Partner
                        </Label>
                      </RadioGroup>
                    </div>
                    <Button
                      type="submit"
                      className="w-full gold-gradient text-primary-foreground"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Create Account <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
