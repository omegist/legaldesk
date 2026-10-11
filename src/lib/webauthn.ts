/**
 * WebAuthn utilities for biometric authentication of the VakilDesk document vault.
 * Uses the browser-native Web Authentication API — no third-party services or cost.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ─── Feature Detection ────────────────────────────────────────────────────────

/** Returns true if the browser supports the WebAuthn API at all. */
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

/** Returns true if a platform authenticator (fingerprint, Face ID, Windows Hello) is available. */
export async function isPlatformAuthAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ─── Challenge Generation ─────────────────────────────────────────────────────

/** Generates a cryptographically random challenge for WebAuthn ceremonies. */
export function generateChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
}

// ─── Registration ─────────────────────────────────────────────────────────────

export interface RegisteredCredential {
  credentialId: string; // base64-encoded
  publicKey: string;    // base64-encoded raw public key bytes
}

/**
 * Prompts the user to register a biometric credential (fingerprint / Face ID / Windows Hello).
 * Must be called from a user gesture (button click).
 *
 * @param userId    The Supabase user UUID — used as the WebAuthn user.id
 * @param userName  The user's email address
 * @param displayName The user's display name
 */
export async function registerCredential(
  userId: string,
  userName: string,
  displayName: string,
): Promise<RegisteredCredential> {
  if (!isWebAuthnSupported()) throw new Error('WebAuthn is not supported on this device.');

  const challenge = generateChallenge();
  const userIdBytes = new TextEncoder().encode(userId);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'VakilDesk',
        id: window.location.hostname,
      },
      user: {
        id: userIdBytes,
        name: userName,
        displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256 (preferred)
        { type: 'public-key', alg: -257 },  // RS256 (fallback)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Use device biometric (not security key)
        userVerification: 'required',        // Must verify fingerprint/PIN
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none', // We don't need attestation for this use-case
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error('Biometric registration was cancelled.');

  const response = credential.response as AuthenticatorAttestationResponse;
  const credentialId = arrayBufferToBase64(credential.rawId);

  // Extract the public key from the attestation object
  // We store the full attestation object as the "public key" for verification
  const publicKey = arrayBufferToBase64(response.attestationObject);

  return { credentialId, publicKey };
}

// ─── Verification ─────────────────────────────────────────────────────────────

export interface VerificationResult {
  credentialId: string;
  verified: boolean;
}

/**
 * Prompts the user to verify their biometric.
 * Must be called from a user gesture (button click).
 *
 * @param credentialIds Array of base64-encoded credential IDs the user registered
 */
export async function verifyCredential(credentialIds: string[]): Promise<VerificationResult> {
  if (!isWebAuthnSupported()) throw new Error('WebAuthn is not supported on this device.');
  if (credentialIds.length === 0) throw new Error('No credentials registered.');

  const challenge = generateChallenge();

  const allowCredentials: PublicKeyCredentialDescriptor[] = credentialIds.map((id) => ({
    type: 'public-key',
    id: base64ToUint8Array(id),
    transports: ['internal'] as AuthenticatorTransport[], // 'internal' = platform biometric
  }));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials,
      userVerification: 'required',
      timeout: 60000,
    },
  }) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Biometric verification was cancelled.');

  // For an MVP, presence of the assertion is sufficient proof.
  // Production apps should send the assertion to the server for cryptographic verification.
  const credentialId = arrayBufferToBase64(assertion.rawId);
  return { credentialId, verified: true };
}

