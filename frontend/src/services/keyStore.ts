/**
 * In-memory key store for the current session.
 * Stores the decrypted private key for signing messages.
 * Keys are cleared on logout.
 */

import { decryptPrivateKey, exportPrivateKeyToPem } from './crypto';

interface KeyStoreState {
  privateKeyPem: string | null;
  publicKeyPem: string | null;
}

const state: KeyStoreState = {
  privateKeyPem: null,
  publicKeyPem: null,
};

/**
 * Initialize the key store with the user's keys.
 * Called after successful login when password is available.
 */
export async function initializeKeyStore(
  encryptedPrivateKey: string,
  password: string,
  salt: string,
  publicKeyPem: string
): Promise<void> {
  try {
    // Decrypt the private key
    const privateKey = await decryptPrivateKey(encryptedPrivateKey, password, salt);

    // Export to PEM for signing
    state.privateKeyPem = await exportPrivateKeyToPem(privateKey);
    state.publicKeyPem = publicKeyPem;

    console.log('Key store initialized');
  } catch (error) {
    console.error('Failed to initialize key store:', error);
    throw error;
  }
}

/**
 * Get the user's private key PEM for signing.
 */
export function getPrivateKeyPem(): string | null {
  return state.privateKeyPem;
}

/**
 * Get the user's public key PEM.
 */
export function getPublicKeyPem(): string | null {
  return state.publicKeyPem;
}

/**
 * Check if the key store is initialized.
 */
export function isKeyStoreInitialized(): boolean {
  return state.privateKeyPem !== null;
}

/**
 * Clear the key store on logout.
 */
export function clearKeyStore(): void {
  state.privateKeyPem = null;
  state.publicKeyPem = null;
  console.log('Key store cleared');
}
