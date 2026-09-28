import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Scale, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Which screen is showing. 'signin'/'signup' are the normal tabs;
// 'confirm-otp' is the 6-digit signup-confirmation code; 'forgot-email' and
// 'forgot-otp' are the two steps of the password-reset flow.
type View = 'signin' | 'signup' | 'confirm-otp' | 'forgot-email' | 'forgot-otp';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'lawyer' | 'partner'>('lawyer');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    // No emailRedirectTo needed anymore — with the "Confirm signup" template
    // set to show {{ .Token }} instead of a link (see setup notes), Supabase
    // sends a 6-digit code by email instead of a clickable URL.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone, role } },
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
      setOtp('');
      setView('confirm-otp');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const handleConfirmSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setIsSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
    setIsSubmitting(false);

    if (error) {
      toast({ title: 'Incorrect or expired code', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Account confirmed', description: 'Welcome to VakilDesk.' });
    navigate('/dashboard', { replace: true });
  };

  const handleResendSignupOtp = async () => {
    setIsSubmitting(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Could not resend code', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Code resent', description: `Check ${email} for a new code.` });
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // With the "Reset Password" template also set to {{ .Token }}, this
    // sends a 6-digit code by email rather than a reset link.
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setIsSubmitting(false);

    // Deliberately show success even if the email doesn't exist — same
    // "don't confirm which accounts are real" principle as sign-in.
    if (error) {
      toast({ title: 'Something went wrong', description: error.message, variant: 'destructive' });
      return;
    }
    setOtp('');
    setNewPassword('');
    setView('forgot-otp');
    toast({ title: 'Code sent', description: `If an account exists for ${email}, a code was sent.` });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: 'Weak password', description: 'Please use at least 8 characters.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' });
    if (verifyError) {
      setIsSubmitting(false);
      toast({ title: 'Incorrect or expired code', description: verifyError.message, variant: 'destructive' });
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);

    if (updateError) {
      toast({ title: 'Could not set new password', description: updateError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Password updated', description: "You're signed in with your new password." });
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background legal-pattern flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <Scale className="h-10 w-10 text-primary" />
            <span className="font-serif text-2xl font-semibold text-gold-gradient">VakilDesk</span>
          </Link>
        </div>

        {view === 'confirm-otp' ? (
          <Card className="glass-effect border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="font-serif text-2xl">Confirm your account</CardTitle>
              <CardDescription>Enter the 6-digit code we sent to {email}.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConfirmSignupOtp} className="space-y-5">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  type="submit"
                  className="w-full gold-gradient text-primary-foreground"
                  disabled={isSubmitting || otp.length !== 6}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm account'}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => setView('signup')}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={handleResendSignupOtp}
                    disabled={isSubmitting}
                    className="text-primary hover:underline"
                  >
                    Resend code
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : view === 'forgot-email' ? (
          <Card className="glass-effect border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="font-serif text-2xl">Reset your password</CardTitle>
              <CardDescription>Enter your account email and we'll send you a code.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@chambers.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gold-gradient text-primary-foreground"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset code'}
                </Button>
                <button
                  type="button"
                  onClick={() => setView('signin')}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </button>
              </form>
            </CardContent>
          </Card>
        ) : view === 'forgot-otp' ? (
          <Card className="glass-effect border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="font-serif text-2xl">Enter your code</CardTitle>
              <CardDescription>
                Enter the 6-digit code sent to {email}, then choose a new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gold-gradient text-primary-foreground"
                  disabled={isSubmitting || otp.length !== 6}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset password'}
                </Button>
                <button
                  type="button"
                  onClick={() => setView('forgot-email')}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
                </button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-effect border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="font-serif text-2xl">
                {view === 'signin' ? 'Welcome Back' : 'Create Your Account'}
              </CardTitle>
              <CardDescription>
                {view === 'signin'
                  ? 'Sign in to access your case diary'
                  : 'Start tracking your matters securely'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={view} onValueChange={(v) => setView(v as View)}>
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password">Password</Label>
                        <button
                          type="button"
                          onClick={() => setView('forgot-email')}
                          className="text-xs text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
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