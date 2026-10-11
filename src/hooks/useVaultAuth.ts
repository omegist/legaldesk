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

/** localStorage key for the simple PIN fallback (SHA-256 hex digest). */
const PIN_STORAGE_KEY = 'vd_vault_pin_hash';

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
  /** Prompt the user to authenticate and unlock the vault. Returns true on success. */
  unlockVault: () => Promise<boolean>;
  /** Lock the vault immediately. */
  lockVault: () => void;
  /** Register the device's biometric as a new credential. Returns true on success. */
  registerBiometric: () => Promise<boolean>;
  /** Set a 6-digit PIN as the fallback. Returns true on success. */
  setPin: (pin: string) => Promise<boolean>;
  /** Verify a PIN the user typed. Returns true if correct. */
  verifyPin: (pin: string) => Promise<boolean>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVaultAuth(): VaultAuthState {
  const { user, profile } = useAuth();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Timestamp when the current unlock session expires.
  const sessionExpiresAt = useRef<number>(0);
  // Auto-lock timer handle.
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Check for stored PIN
    setHasPin(!!localStorage.getItem(PIN_STORAGE_KEY));
  }, [user]);

  // ─── Session management ────────────────────────────────────────────────────

  const grantSession = useCallback(() => {
    sessionExpiresAt.current = Date.now() + SESSION_DURATION_MS;
    setIsUnlocked(true);
    // Auto-lock when the session expires
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

  // Check if an existing session is still valid on each call
  const isSessionValid = useCallback(() => {
    if (Date.now() < sessionExpiresAt.current) return true;
    if (isUnlocked) setIsUnlocked(false); // expired — sync state
    return false;
  }, [isUnlocked]);

  // ─── Registration ──────────────────────────────────────────────────────────

  const registerBiometric = useCallback(async (): Promise<boolean> => {
    if (!user || !profile) return false;
    if (!isWebAuthnSupported()) return false;

    setIsRegistering(true);
    try {
      const { credentialId, publicKey } = await registerCredential(
        user.id,
        profile.email,
        profile.name,
      );

      const { error } = await supabase.from('vault_credentials').insert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKey,
        device_name:
          navigator.userAgent.includes('iPhone')
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
  }, [user, profile]);

  // ─── PIN management ────────────────────────────────────────────────────────

  const setPin = useCallback(async (pin: string): Promise<boolean> => {
    if (pin.length !== 6) return false;
    try {
      const hash = await sha256Hex(pin + (user?.id ?? ''));
      localStorage.setItem(PIN_STORAGE_KEY, hash);
      setHasPin(true);
      return true;
    } catch {
      return false;
    }
  }, [user]);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
    if (!storedHash) return false;
    try {
      const hash = await sha256Hex(pin + (user?.id ?? ''));
      const correct = hash === storedHash;
      if (correct) grantSession();
      return correct;
    } catch {
      return false;
    }
  }, [user, grantSession]);

  // ─── Unlock ────────────────────────────────────────────────────────────────

  const unlockVault = useCallback(async (): Promise<boolean> => {
    // If still within the session window, no need to re-authenticate
    if (isSessionValid()) return true;
    if (!user) return false;

    setIsVerifying(true);
    try {
      // Try biometric first if available and credentials exist
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
      // Caller is responsible for showing the PIN fallback via VaultAuthGate
      return false;
    } catch {
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [user, hasBiometrics, hasCredentials, isSessionValid, grantSession]);

  return {
    isUnlocked,
    hasCredentials,
    hasBiometrics,
    hasPin,
    isRegistering,
    isVerifying,
    unlockVault,
    lockVault,
    registerBiometric,
    setPin,
    verifyPin,
  };
}
