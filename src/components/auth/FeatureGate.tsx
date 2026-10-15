import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import type { SubscriptionTier } from '@/types';

type FeatureGateProps = {
  children: ReactNode;
  minimumTier: 'pro' | 'chambers';
  feature: string;
  description: string;
};

const PAID_TIERS: SubscriptionTier[] = ['pro', 'chambers', 'firm'];
const TEAM_TIERS: SubscriptionTier[] = ['chambers', 'firm'];

export function FeatureGate({ children, minimumTier, feature, description }: FeatureGateProps) {
  const { profile, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) return null;

  // Invited firm members inherit their firm's feature access. Their own
  // profile remains on the Free tier so that a departing member is not left
  // with a paid subscription.
  const tiers = minimumTier === 'pro' ? PAID_TIERS : TEAM_TIERS;
  const hasAccess = !!profile && (tiers.includes(profile.subscription_tier) || !!profile.firm_id);
  if (hasAccess) return <>{children}</>;

  const planName = minimumTier === 'pro' ? 'Pro' : 'Chambers';
  return (
    <div className="min-h-screen bg-background legal-pattern">
      <Header />
      <main className="container flex min-h-[calc(100vh-4rem)] max-w-lg items-center justify-center py-8">
        <Card className="w-full border-primary/30 glass-effect">
          <CardContent className="space-y-4 p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h1 className="font-serif text-2xl font-bold">{feature} is locked</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="text-sm font-medium">Available on the {planName} plan and above.</p>
            <Button className="gold-gradient text-primary-foreground" onClick={() => navigate('/pricing')}>
              View plans
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
