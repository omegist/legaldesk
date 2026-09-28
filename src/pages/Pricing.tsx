import { useEffect, useState } from 'react';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { SubscriptionTier } from '@/types';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface Plan {
  tier: SubscriptionTier;
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    tier: 'free',
    name: 'Free',
    price: '₹0',
    cadence: 'forever',
    description: 'Try VakilDesk with your first few matters.',
    features: ['Up to 5 active cases', 'Manual case tracking', 'Case timeline & notes'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '₹499',
    cadence: '/month',
    description: 'For a busy solo practice.',
    features: [
      'Unlimited cases',
      'Email hearing reminders',
      'WhatsApp reminders (coming soon)',
      'Cloud document vault',
      'Priority support',
    ],
    highlighted: true,
  },
  {
    tier: 'firm',
    name: 'Firm',
    price: '₹2,499',
    cadence: '/month',
    description: 'For chambers with multiple lawyers.',
    features: [
      'Everything in Pro',
      'Multi-user firm logins',
      'Shared firm calendar',
      'Centralized billing',
      'Firm branding',
    ],
  },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Pricing() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [subInfo, setSubInfo] = useState<{ status: string; cancel_at_period_end: boolean; current_period_end: string | null } | null>(null);

  const currentTier = profile?.subscription_tier ?? 'free';

  useEffect(() => {
    if (!user) return;
    supabase
      .from('subscriptions')
      .select('status, cancel_at_period_end, current_period_end')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSubInfo(data));
  }, [user, currentTier]);

  const handleSelect = async (tier: SubscriptionTier) => {
    if (!user) {
      toast({ title: 'Sign in first', description: 'Create an account to choose a plan.' });
      return;
    }
    if (tier === currentTier) return;

    if (tier === 'free') {
      // Downgrading from a paid plan should go through cancellation (so
      // Razorpay's mandate actually stops), not a silent DB flip.
      if (currentTier !== 'free') {
        setShowCancelDialog(true);
        return;
      }
      return;
    }

    setPendingTier(tier);
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setPendingTier(null);
      toast({ title: 'Could not load payment form', description: 'Check your connection and try again.', variant: 'destructive' });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-create-subscription`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      },
    );
    const order = await res.json();

    if (!res.ok) {
      setPendingTier(null);
      toast({ title: 'Could not start checkout', description: order.error, variant: 'destructive' });
      return;
    }

    const razorpay = new window.Razorpay({
      key: order.key_id,
      subscription_id: order.subscription_id,
      name: 'VakilDesk',
      description: `${tier === 'pro' ? 'Pro' : 'Firm'} plan — billed monthly, cancel anytime`,
      theme: { color: '#c9a24b' },
      prefill: { email: profile?.email, contact: profile?.phone ?? undefined },
      handler: async () => {
        toast({
          title: 'Payment received',
          description: 'Activating your plan — this takes a few seconds.',
        });
        // The webhook is the real source of truth; this just gives the
        // person a quick visual update once it's caught up.
        setTimeout(async () => {
          await refreshProfile();
          setPendingTier(null);
        }, 4000);
      },
      modal: {
        ondismiss: () => setPendingTier(null),
      },
    });
    razorpay.open();
  };

  const confirmCancel = async () => {
    setCancelling(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-cancel-subscription`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
    );
    const result = await res.json();
    setCancelling(false);
    setShowCancelDialog(false);

    if (!res.ok) {
      toast({ title: 'Could not cancel', description: result.error, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Subscription cancelled',
      description: 'You will keep access until the end of your current billing period, then move to the Free plan.',
    });
    setSubInfo((s) => (s ? { ...s, cancel_at_period_end: true } : s));
  };

  return (
    <div className="min-h-screen bg-background legal-pattern">
      <Header />
      <main className="container max-w-5xl py-10">
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl font-bold mb-2">Plans for every chamber</h1>
          <p className="text-muted-foreground">Simple pricing that grows with your practice. Cancel anytime.</p>
        </div>

        {subInfo?.cancel_at_period_end && currentTier !== 'free' && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 max-w-2xl mx-auto">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-sm">
              Your {currentTier === 'pro' ? 'Pro' : 'Firm'} plan is set to cancel
              {subInfo.current_period_end
                ? ` on ${new Date(subInfo.current_period_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : ' at the end of the current billing period'}
              . You'll keep full access until then.
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === currentTier;
            const canCancel = isCurrent && plan.tier !== 'free' && !subInfo?.cancel_at_period_end;
            return (
              <Card
                key={plan.tier}
                className={cn(
                  'flex flex-col glass-effect',
                  plan.highlighted ? 'border-primary shadow-lg shadow-primary/10' : 'border-primary/20',
                )}
              >
                <CardHeader>
                  {plan.highlighted && (
                    <span className="mb-2 inline-block w-fit rounded-full bg-primary/15 px-3 py-1 text-[11px] font-medium text-primary">
                      Most popular
                    </span>
                  )}
                  <CardTitle className="font-serif text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.cadence}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button
                    className={cn('w-full', plan.highlighted && 'gold-gradient text-primary-foreground')}
                    variant={plan.highlighted ? 'default' : 'outline'}
                    disabled={isCurrent || pendingTier === plan.tier}
                    onClick={() => handleSelect(plan.tier)}
                  >
                    {pendingTier === plan.tier ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrent ? (
                      'Current plan'
                    ) : (
                      `Choose ${plan.name}`
                    )}
                  </Button>
                  {canCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground hover:text-destructive"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      Cancel subscription
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </main>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose access to unlimited cases, the document vault, and hearing reminders once your
              current billing period ends
              {subInfo?.current_period_end
                ? ` (${new Date(subInfo.current_period_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`
                : ''}
              . Any cases beyond the Free plan's 5-case limit will stay visible, but you won't be able to add
              new ones until you're back under that limit or resubscribe. This can't be undone from here —
              you'd need to subscribe again to restore autopay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep my subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmCancel();
              }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}