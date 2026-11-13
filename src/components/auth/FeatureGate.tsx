import { useEffect, useRef, type ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preview = previewRef.current as (HTMLDivElement & { inert: boolean }) | null;
    if (preview) preview.inert = true;
  }, []);

  if (isLoading) return null;

  // Invited firm members inherit their firm's feature access. Their own
  // profile remains on the Free tier so that a departing member is not left
  // with a paid subscription.
  const tiers = minimumTier === 'pro' ? PAID_TIERS : TEAM_TIERS;
  const hasAccess = !!profile && (tiers.includes(profile.subscription_tier) || !!profile.firm_id);
  if (hasAccess) return <>{children}</>;

  const planName = minimumTier === 'pro' ? 'Pro' : 'Chambers';
  return (
    <div className="relative min-h-screen">
      <div ref={previewRef} aria-hidden="true" className="pointer-events-none select-none opacity-60">
        {children}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-primary/40 bg-background/95 p-3 shadow-lg backdrop-blur">
        <Card className="mx-auto max-w-3xl border-primary/30 glass-effect">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{feature} is for paid plans</p>
                <p className="text-sm text-muted-foreground">{description} Upgrade to {planName} or above to use it.</p>
              </div>
            </div>
            <Button className="gold-gradient text-primary-foreground" onClick={() => navigate('/pricing')}>
              View plans
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
