import { scrypt } from 'scrypt-js';

// Same parameters as Python implementation: n=2^14, r=8, p=1
const SCRYPT_N = 16384; // 2^14
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_DKLEN = 32; // 256 bits

/**
 * Generate a random salt for password hashing
 */
export function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return arrayToHex(salt);
}

/**
 * Derive a key from password using Scrypt KDF
 * Compatible with Python's Scrypt implementation
 */
export async function deriveKey(
  password: string,
  saltHex: string
): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = hexToArray(saltHex);

  const derivedKey = await scrypt(
    passwordBytes,
    saltBytes,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    SCRYPT_DKLEN
  );

  return arrayToHex(new Uint8Array(derivedKey));
}

/**
 * Derive an encryption key for private key storage
 */
export async function deriveEncryptionKey(
  password: string,
  saltHex: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = hexToArray(saltHex);

  const derivedKeyBytes = await scrypt(
    passwordBytes,
    saltBytes,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    SCRYPT_DKLEN
  );

  return crypto.subtle.importKey(
    'raw',
    derivedKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Utility functions
export function hexToArray(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export function arrayToHex(array: Uint8Array): string {
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function arrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

export function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
