import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // The saved browser session is validated below with getUser(). Do not
      // trust INITIAL_SESSION because it can belong to a user deleted remotely.
      if (event === 'INITIAL_SESSION') return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => {
          loadProfile(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    const validateSavedSession = async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (!existing) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      // getSession() reads local storage only. getUser() verifies the token
      // with Supabase, so a deleted user cannot continue using a stale session.
      const { data: userData, error } = await supabase.auth.getUser(existing.access_token);
      if (error || !userData.user) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setSession(existing);
      setUser(userData.user);
      await loadProfile(userData.user.id);
      setIsLoading(false);
    };

    void validateSavedSession();

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const logout = useCallback(async () => {
    // Clear Capacitor Preferences (SharedPreferences on Android,
    // CapacitorStorage.* prefixed localStorage on web) BEFORE signing out so
    // the keys are accessible while the session is still valid.
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { keys } = await Preferences.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('offline_'))
          .map((key) => Preferences.remove({ key })),
      );
    } catch {
      // Capacitor not available (pure web build) — fall back to localStorage scan
      try {
        const keysToRemove = Object.keys(localStorage).filter((k) =>
          k.startsWith('vd_') || k.startsWith('vault_') || k.startsWith('offline_') ||
          k.startsWith('CapacitorStorage.offline_'),
        );
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // Storage not available — safe to ignore
      }
    }
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAuthenticated: !!session,
        isLoading,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
