import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { saveOffline, loadOffline } from '@/lib/native';
import { useAuth } from '@/contexts/AuthContext';
import type { Diary } from '@/types';

// Strip PII before caching
function sanitize(cases: Diary[]): Diary[] {
  return cases.map((c) => ({ ...c, client_phone: null, client_email: null }));
}

export function useOfflineCases() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Diary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const hasFetched = useRef(false);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      // Clear cache on logout
      setCases([]);
      hasFetched.current = false;
      return;
    }

    if (hasFetched.current) return;
    hasFetched.current = true;

    const cacheKey = `offline_cases_${user.id}`;

    (async () => {
      if (!navigator.onLine) {
        const cached = await loadOffline<Diary[]>(cacheKey);
        setCases(cached ?? []);
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from('diaries')
        .select('*')
        .order('matter_date', { ascending: false });

      const fresh = (data as Diary[]) ?? [];
      setCases(fresh);
      setIsLoading(false);

      await saveOffline(cacheKey, sanitize(fresh));
    })();
  }, [user]);

  return { cases, isLoading, isOffline };
}
