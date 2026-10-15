import { supabase } from '@/integrations/supabase/client';

export function trackProductEvent(event: 'signup_started' | 'signup_confirmed' | 'password_reset_requested' | 'password_reset_completed' | 'checkout_started' | 'checkout_completed', accessToken?: string) {
  void supabase.functions.invoke('track-product-event', {
    body: { event },
    ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
  });
}
