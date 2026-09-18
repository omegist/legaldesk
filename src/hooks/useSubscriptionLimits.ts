import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { SubscriptionTier } from '@/types';

export const TIER_LIMITS: Record<SubscriptionTier, { activeCases: number | null; label: string }> = {
  free: { activeCases: 5, label: 'Free' },
  pro: { activeCases: null, label: 'Pro' },
  firm: { activeCases: null, label: 'Firm' },
};

/**
 * Client-side mirror of the database rule that caps Free accounts at 5 active
 * cases. The database trigger is the real enforcement point — this hook only
 * decides when to show the upgrade prompt.
 */
export function useSubscriptionLimits() {
  const { user, profile } = useAuth();
  const [activeCases, setActiveCases] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const tier: SubscriptionTier = profile?.subscription_tier ?? 'free';
  const limit = TIER_LIMITS[tier].activeCases;

  const refresh = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('diaries')
      .select('id', { count: 'exact', head: true })
      .eq('lawyer_id', user.id)
      .eq('status', 'active');
    setActiveCases(count ?? 0);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    tier,
    tierLabel: TIER_LIMITS[tier].label,
    activeCases,
    limit,
    isLoading,
    refresh,
    canCreateCase: limit === null || activeCases < limit,
    remaining: limit === null ? null : Math.max(0, limit - activeCases),
  };
}
