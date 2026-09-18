import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { SubscriptionTier } from '@/types';

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
    price: 'â‚¹0',
    cadence: 'forever',
    description: 'Try Legal Diary with your first few matters.',
    features: ['Up to 5 active cases', 'Manual case tracking', 'Case timeline & notes'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 'â‚¹499',
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
    price: 'â‚¹2,499',
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

export default function Pricing() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);

  const currentTier = profile?.subscription_tier ?? 'free';

  const handleSelect = async (tier: SubscriptionTier) => {
    if (!user) {
      toast({ title: 'Sign in first', description: 'Create an account to choose a plan.' });
      return;
    }
    if (tier === currentTier) return;

    // Payment gateway (Razorpay) isn't wired up yet â€” this is a placeholder
    // path so the pricing page is usable before that integration lands.
    // Downgrading to Free, or moving from Free, doesn't need money to move,
    // so we apply that instantly; anything requiring payment shows a
    // "contact us" flow until Razorpay is in place.
    if (tier === 'free') {
      setPendingTier(tier);
      const { error } = await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', user.id);
      setPendingTier(null);
      if (error) {
        toast({ title: 'Could not change plan', description: error.message, variant: 'destructive' });
        return;
      }
      await refreshProfile();
      toast({ title: `You're on the Free plan now` });
      return;
    }

    toast({
      title: `Upgrading to ${tier === 'pro' ? 'Pro' : 'Firm'}`,
      description: 'Online payment is coming soon. WhatsApp us and we\'ll activate your plan manually in the meantime.',
    });
  };

  return (
    <div className="min-h-screen bg-background legal-pattern">
      <Header />
      <main className="container max-w-5xl py-10">
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl font-bold mb-2">Plans for every chamber</h1>
          <p className="text-muted-foreground">Simple pricing that grows with your practice.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === currentTier;
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
                <CardFooter>
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
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}