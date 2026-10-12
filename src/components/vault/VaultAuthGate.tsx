import { useState } from 'react';
import { Fingerprint, KeyRound, ShieldCheck, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import type { VaultAuthState } from '@/hooks/useVaultAuth';

// ─── Props ────────────────────────────────────────────────────────────────────

interface VaultAuthGateProps {
  open: boolean;
  /** Called when authentication succeeds. */
  onAuthenticated: () => void;
  /** Called when the user dismisses without authenticating. */
  onCancel: () => void;
  /** 'verify' = unlock the vault, 'register' = set up screen lock for the first time. */
  mode: 'verify' | 'register';
  auth: VaultAuthState;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VaultAuthGate({ open, onAuthenticated, onCancel, mode, auth }: VaultAuthGateProps) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  // accountPassword is required before saving/clearing a PIN to prevent bypass.
  const [accountPassword, setAccountPassword] = useState('');
  const [step, setStep] = useState<'choose' | 'pin-password' | 'pin-set' | 'pin-confirm' | 'pin-verify'>('choose');
  const [showBiometricError, setShowBiometricError] = useState('');

  const reset = () => {
    setPin('');
    setConfirmPin('');
    setPinError('');
    setAccountPassword('');
    setShowBiometricError('');
    setStep('choose');
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
      onCancel();
    }
  };

  // ─── Register flow ─────────────────────────────────────────────────────────

  const handleRegisterBiometric = async () => {
    setShowBiometricError('');
    const success = await auth.registerBiometric();
    if (success) {
      reset();
      onAuthenticated();
    } else {
      setShowBiometricError('Biometric registration failed or was cancelled. Try setting a PIN instead.');
    }
  };

  const handleSetPin = () => {
    if (pin.length !== 6) { setPinError('Please enter a 6-digit PIN.'); return; }
    setStep('pin-confirm');
  };

  const handleConfirmPin = async () => {
    if (confirmPin !== pin) { setPinError('PINs do not match. Try again.'); setConfirmPin(''); return; }
    if (!accountPassword) { setPinError('Please enter your account password to confirm.'); return; }

    const result = await auth.setPin(pin, accountPassword);
    if (result.ok) { reset(); onAuthenticated(); }
    else setPinError(result.error ?? 'Could not save PIN. Please try again.');
  };

  // ─── Verify flow ───────────────────────────────────────────────────────────

  const handleVerifyBiometric = async () => {
    setShowBiometricError('');
    const success = await auth.unlockVault();
    if (success) { reset(); onAuthenticated(); }
    else setShowBiometricError('Biometric verification failed. Try your PIN instead.');
  };

  const handleVerifyPin = async () => {
    if (pin.length !== 6) return;
    if (auth.lockoutSecondsLeft > 0) return;
    const ok = await auth.verifyPin(pin);
    if (ok) { reset(); onAuthenticated(); }
    else {
      const secondsLeft = auth.lockoutSecondsLeft;
      if (secondsLeft > 0) {
        setPinError(`Too many incorrect attempts. Wait ${secondsLeft}s before trying again.`);
      } else {
        setPinError('Incorrect PIN. Please try again.');
      }
      setPin('');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const isLoading = auth.isRegistering || auth.isVerifying;
  const isLockedOut = auth.lockoutSecondsLeft > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm bg-background border-primary/30">
        <DialogHeader className="items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/30 mb-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="font-serif text-xl">
            {mode === 'register' ? 'Set Up Screen Lock' : 'Screen Lock Active'}
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            {mode === 'register'
              ? 'Add a fingerprint or PIN screen lock for sensitive legal documents. This is a device-level screen lock — not cryptographic encryption.'
              : 'This document has a screen lock. Verify with your fingerprint or PIN to continue.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">

          {/* ── REGISTER: choose method ── */}
          {mode === 'register' && step === 'choose' && (
            <>
              {auth.hasBiometrics && (
                <Button
                  className="w-full gold-gradient text-primary-foreground h-12"
                  onClick={handleRegisterBiometric}
                  disabled={isLoading}
                >
                  {auth.isRegistering
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Fingerprint className="mr-2 h-5 w-5" />}
                  Use Fingerprint / Face ID
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full h-12 border-primary/30"
                onClick={() => setStep('pin-password')}
                disabled={isLoading}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Set a 6-digit PIN
              </Button>
              {showBiometricError && (
                <p className="text-xs text-destructive text-center">{showBiometricError}</p>
              )}
            </>
          )}

          {/* ── REGISTER: confirm account password before PIN ── */}
          {mode === 'register' && step === 'pin-password' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Enter your VakilDesk account password to confirm your identity before setting a PIN.
              </p>
              <Input
                type="password"
                placeholder="Account password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                className="bg-secondary/50"
              />
              {pinError && <p className="text-xs text-destructive">{pinError}</p>}
              <Button
                className="w-full gold-gradient text-primary-foreground"
                onClick={() => {
                  if (!accountPassword) { setPinError('Please enter your account password.'); return; }
                  setPinError('');
                  setStep('pin-set');
                }}
              >
                Continue
              </Button>
              <button onClick={() => setStep('choose')} className="text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
            </div>
          )}

          {/* ── REGISTER: enter new PIN ── */}
          {mode === 'register' && step === 'pin-set' && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">Enter a new 6-digit PIN</p>
              <InputOTP maxLength={6} value={pin} onChange={(v) => { setPin(v); setPinError(''); }}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
              {pinError && <p className="text-xs text-destructive">{pinError}</p>}
              <Button className="w-full gold-gradient text-primary-foreground" onClick={handleSetPin} disabled={pin.length !== 6}>
                Continue
              </Button>
              <button onClick={() => setStep('pin-password')} className="text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
            </div>
          )}

          {/* ── REGISTER: confirm PIN ── */}
          {mode === 'register' && step === 'pin-confirm' && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">Confirm your PIN</p>
              <InputOTP maxLength={6} value={confirmPin} onChange={(v) => { setConfirmPin(v); setPinError(''); }}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
              {pinError && <p className="text-xs text-destructive">{pinError}</p>}
              <Button className="w-full gold-gradient text-primary-foreground" onClick={handleConfirmPin} disabled={confirmPin.length !== 6}>
                Save PIN
              </Button>
            </div>
          )}

          {/* ── VERIFY: biometric or PIN ── */}
          {mode === 'verify' && (
            <>
              {(auth.hasCredentials && auth.hasBiometrics) && (
                <Button
                  className="w-full gold-gradient text-primary-foreground h-12"
                  onClick={handleVerifyBiometric}
                  disabled={isLoading}
                >
                  {auth.isVerifying
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Fingerprint className="mr-2 h-5 w-5" />}
                  Scan Fingerprint / Face ID
                </Button>
              )}

              {auth.hasPin && (
                <div className={cn('flex flex-col items-center gap-3', auth.hasCredentials && auth.hasBiometrics && 'pt-2 border-t border-border/40')}>
                  {(auth.hasCredentials && auth.hasBiometrics) && (
                    <p className="text-xs text-muted-foreground">Or enter your PIN</p>
                  )}
                  {isLockedOut ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Lock className="h-6 w-6 text-destructive" />
                      <p className="text-sm text-destructive font-medium">Too many incorrect attempts</p>
                      <p className="text-xs text-muted-foreground">
                        Try again in <strong>{auth.lockoutSecondsLeft}s</strong>
                      </p>
                    </div>
                  ) : (
                    <InputOTP
                      maxLength={6}
                      value={pin}
                      onChange={(v) => { setPin(v); setPinError(''); }}
                    >
                      <InputOTPGroup>
                        {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                      </InputOTPGroup>
                    </InputOTP>
                  )}
                  {pinError && <p className="text-xs text-destructive">{pinError}</p>}
                  <Button
                    variant="outline"
                    className="w-full border-primary/30"
                    onClick={handleVerifyPin}
                    disabled={pin.length !== 6 || isLoading || isLockedOut}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Unlock with PIN
                  </Button>
                </div>
              )}

              {/* Neither biometric nor PIN set up yet */}
              {!auth.hasCredentials && !auth.hasPin && (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You haven't set up a screen lock yet.
                  </p>
                  <Button
                    className="w-full gold-gradient text-primary-foreground"
                    onClick={() => { onCancel(); }}
                  >
                    Set Up Screen Lock First
                  </Button>
                </div>
              )}

              {showBiometricError && (
                <p className="text-xs text-destructive text-center">{showBiometricError}</p>
              )}
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
