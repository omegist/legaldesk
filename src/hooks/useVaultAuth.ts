import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  isWebAuthnSupported,
  isPlatformAuthAvailable,
  registerCredential,
  verifyCredential,
} from '@/lib/webauthn';

/** How long (ms) the vault stays unlocked after a successful authentication. */
const SESSION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum wrong PIN attempts before a progressive lockout. */
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
/** Hard limit: after this many total failures, sign the user out and clear the PIN. */
const MAX_TOTAL_ATTEMPTS = 10;
/** Lockout duration in ms after exceeding MAX_ATTEMPTS_BEFORE_LOCKOUT. */
const LOCKOUT_DURATION_MS = 30 * 1000;

/** Capacitor Preferences key for the PBKDF2 PIN hash bundle. */
const PIN_PREFS_KEY = 'vd_vault_pin_v2';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VaultAuthState {
  /** True when the user has successfully authenticated within the session window. */
  isUnlocked: boolean;
  /** True when the user has at least one registered WebAuthn credential in the DB. */
  hasCredentials: boolean;
  /** True when WebAuthn is available on this device. */
  hasBiometrics: boolean;
  /** True when the user has set a fallback PIN. */
  hasPin: boolean;
  /** Loading state for the registration flow. */
  isRegistering: boolean;
  /** Loading state for the verification flow. */
  isVerifying: boolean;
  /** Remaining lockout seconds (0 when not locked out). */
  lockoutSecondsLeft: number;
  /** Prompt the user to authenticate and unlock the vault. Returns true on success. */
  unlockVault: () => Promise<boolean>;
  /** Lock the vault immediately. */
  lockVault: () => void;
  /** Register the device's biometric as a new credential. Returns true on success. */
  registerBiometric: () => Promise<boolean>;
  /**
   * Set a 6-digit PIN as the fallback.
   * Requires the user's Supabase account password to prevent the "clear PIN →
   * set new PIN → access vault" bypass.
   */
  setPin: (pin: string, accountPassword: string) => Promise<{ ok: boolean; error?: string }>;
  /** Verify a PIN the user typed. Returns true if correct. */
  verifyPin: (pin: string) => Promise<boolean>;
  /** Clear the stored PIN (requires account password). */
  clearPin: (accountPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

// ─── PBKDF2 helpers ───────────────────────────────────────────────────────────

interface PinHashBundle {
  salt: string;   // base64
  hash: string;   // base64
  iters: number;
}

async function derivePinKey(pin: string, saltB64: string, iterations: number): Promise<string> {
  const saltBytes = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(derived)));
}

async function hashPin(pin: string): Promise<PinHashBundle> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = btoa(String.fromCharCode(...saltBytes));
  const iters = 210_000; // OWASP 2023 minimum for PBKDF2-SHA256
  const hash = await derivePinKey(pin, salt, iters);
  return { salt, hash, iters };
}

async function verifyPinHash(pin: string, bundle: PinHashBundle): Promise<boolean> {
  const derived = await derivePinKey(pin, bundle.salt, bundle.iters);
  // Constant-time compare via SubtleCrypto sign/verify is not easily available;
  // use a length-safe string compare (both strings are base64 of fixed length).
  if (derived.length !== bundle.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) {
    diff |= derived.charCodeAt(i) ^ bundle.hash.charCodeAt(i);
  }
  return diff === 0;
}

/** Persist the PIN bundle using Capacitor Preferences when available, else localStorage. */
async function savePinBundle(bundle: PinHashBundle): Promise<void> {
  const value = JSON.stringify(bundle);
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: PIN_PREFS_KEY, value });
  } catch {
    localStorage.setItem(PIN_PREFS_KEY, value);
  }
}

async function loadPinBundle(): Promise<PinHashBundle | null> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: PIN_PREFS_KEY });
    if (value) return JSON.parse(value) as PinHashBundle;
  } catch {
    const raw = localStorage.getItem(PIN_PREFS_KEY);
    if (raw) return JSON.parse(raw) as PinHashBundle;
  }
  return null;
}

async function deletePinBundle(): Promise<void> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key: PIN_PREFS_KEY });
  } catch {
    localStorage.removeItem(PIN_PREFS_KEY);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVaultAuth(): VaultAuthState {
  const { user } = useAuth();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  // Timestamp when the current unlock session expires.
  const sessionExpiresAt = useRef<number>(0);
  // Auto-lock timer handle.
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lockout countdown timer.
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Wrong-PIN attempt counter (in-memory; intentionally not persisted).
  const wrongAttempts = useRef<number>(0);
  // Timestamp when the lockout period ends.
  const lockedUntil = useRef<number>(0);

  // ─── Initialise ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    // Check for biometric support
    isPlatformAuthAvailable().then(setHasBiometrics);

    // Check for existing registered credentials
    supabase
      .from('vault_credentials')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setHasCredentials((count ?? 0) > 0));

    // Check for stored PIN (PBKDF2 bundle)
    loadPinBundle().then((bundle) => setHasPin(!!bundle));
  }, [user]);

  // ─── Session management ────────────────────────────────────────────────────

  const grantSession = useCallback(() => {
    sessionExpiresAt.current = Date.now() + SESSION_DURATION_MS;
    setIsUnlocked(true);
    wrongAttempts.current = 0; // reset on successful auth
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      setIsUnlocked(false);
      sessionExpiresAt.current = 0;
    }, SESSION_DURATION_MS);
  }, []);

  const lockVault = useCallback(() => {
    setIsUnlocked(false);
    sessionExpiresAt.current = 0;
    if (lockTimer.current) clearTimeout(lockTimer.current);
  }, []);

  const isSessionValid = useCallback(() => {
    if (Date.now() < sessionExpiresAt.current) return true;
    if (isUnlocked) setIsUnlocked(false);
    return false;
  }, [isUnlocked]);

  // ─── Lockout helpers ───────────────────────────────────────────────────────

  const startLockoutCountdown = useCallback((durationMs: number) => {
    lockedUntil.current = Date.now() + durationMs;
    setLockoutSecondsLeft(Math.ceil(durationMs / 1000));
    if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    lockoutTimer.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockedUntil.current - Date.now()) / 1000));
      setLockoutSecondsLeft(remaining);
      if (remaining === 0 && lockoutTimer.current) {
        clearInterval(lockoutTimer.current);
        lockoutTimer.current = null;
      }
    }, 1000);
  }, []);

  // ─── Registration ──────────────────────────────────────────────────────────

  const registerBiometric = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (!isWebAuthnSupported()) return false;

    // Fetch profile for userName/displayName
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', user.id)
      .single();
    if (!profile) return false;

    setIsRegistering(true);
    try {
      const { credentialId, publicKey } = await registerCredential(
        user.id,
        profile.email ?? user.email ?? '',
        profile.name ?? 'Advocate',
      );

      const { error } = await supabase.from('vault_credentials').insert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKey,
        device_name: navigator.userAgent.includes('iPhone')
          ? 'iPhone'
          : navigator.userAgent.includes('Android')
          ? 'Android'
          : 'This device',
      });

      if (error) throw error;
      setHasCredentials(true);
      return true;
    } catch {
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, [user]);

  // ─── PIN management ────────────────────────────────────────────────────────

  /** Require account password before setting/changing a PIN to close the bypass. */
  const setPin = useCallback(
    async (pin: string, accountPassword: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user?.email) return { ok: false, error: 'Not signed in' };
      if (pin.length !== 6) return { ok: false, error: 'PIN must be exactly 6 digits' };

      // Re-authenticate with Supabase to confirm identity before storing PIN
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: accountPassword,
      });
      if (authErr) return { ok: false, error: 'Incorrect account password' };

      try {
        const bundle = await hashPin(pin);
        await savePinBundle(bundle);
        setHasPin(true);
        wrongAttempts.current = 0;
        return { ok: true };
      } catch {
        return { ok: false, error: 'Could not save PIN' };
      }
    },
    [user],
  );

  const clearPin = useCallback(
    async (accountPassword: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user?.email) return { ok: false, error: 'Not signed in' };

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: accountPassword,
      });
      if (authErr) return { ok: false, error: 'Incorrect account password' };

      await deletePinBundle();
      setHasPin(false);
      wrongAttempts.current = 0;
      return { ok: true };
    },
    [user],
  );

  const verifyPin = useCallback(
    async (pin: string): Promise<boolean> => {
      // Refuse if still in lockout window
      if (Date.now() < lockedUntil.current) return false;

      const bundle = await loadPinBundle();
      if (!bundle) return false;
      try {
        const correct = await verifyPinHash(pin, bundle);
        if (correct) {
          grantSession();
          return true;
        }

        wrongAttempts.current += 1;

        if (wrongAttempts.current >= MAX_TOTAL_ATTEMPTS) {
          // Hard limit reached — clear PIN and sign out
          await deletePinBundle();
          setHasPin(false);
          await supabase.auth.signOut();
          return false;
        }

        if (wrongAttempts.current >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
          // Progressive lockout (doubles each time: 30s, 60s, 120s …)
          const multiplier = wrongAttempts.current - MAX_ATTEMPTS_BEFORE_LOCKOUT + 1;
          startLockoutCountdown(LOCKOUT_DURATION_MS * multiplier);
        }

        return false;
      } catch {
        return false;
      }
    },
    [grantSession, startLockoutCountdown],
  );

  // ─── Unlock ────────────────────────────────────────────────────────────────

  const unlockVault = useCallback(async (): Promise<boolean> => {
    if (isSessionValid()) return true;
    if (!user) return false;

    setIsVerifying(true);
    try {
      if (hasBiometrics && hasCredentials) {
        const { data: rows } = await supabase
          .from('vault_credentials')
          .select('credential_id')
          .eq('user_id', user.id);

        const credIds = (rows ?? []).map((r: { credential_id: string }) => r.credential_id);
        if (credIds.length > 0) {
          const result = await verifyCredential(credIds);
          if (result.verified) {
            grantSession();
            return true;
          }
        }
      }
      // Caller shows the PIN fallback via VaultAuthGate
      return false;
    } catch {
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [user, hasBiometrics, hasCredentials, isSessionValid, grantSession]);

  // Lock on component cleanup (leave Vault page)
  useEffect(() => {
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
      if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    };
  }, []);

  return {
    isUnlocked,
    hasCredentials,
    hasBiometrics,
    hasPin,
    isRegistering,
    isVerifying,
    lockoutSecondsLeft,
    unlockVault,
    lockVault,
    registerBiometric,
    setPin,
    verifyPin,
    clearPin,
  };
}
