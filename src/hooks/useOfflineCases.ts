import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { saveOffline, loadOffline } from '@/lib/native';
import { useAuth } from '@/contexts/AuthContext';
import type { Diary } from '@/types';

const CACHE_KEY = 'offline_cases';
const CACHE_TS_KEY = 'offline_cases_ts';

export function useOfflineCases() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Diary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const hasFetched = useRef(false);

  // Track online/offline transitions
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
    if (!user || hasFetched.current) return;
    hasFetched.current = true;

    (async () => {
      if (!navigator.onLine) {
        // Load from cache
        const cached = await loadOffline<Diary[]>(CACHE_KEY);
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

      // Persist to cache
      await saveOffline(CACHE_KEY, fresh);
      await saveOffline(CACHE_TS_KEY, new Date().toISOString());
    })();
  }, [user]);

  return { cases, isLoading, isOffline };
}
