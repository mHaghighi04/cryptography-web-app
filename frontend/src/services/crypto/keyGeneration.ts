import { deriveEncryptionKey, arrayToBase64, base64ToArray, hexToArray, arrayToHex } from './kdf';

/**
 * Generate RSA-2048 key pair for encryption (OAEP) and signing (PSS)
 */
export async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyPem: string;
  privateKeyPem: string;
}> {
  // Generate key pair for encryption (RSA-OAEP)
  const encryptionKeyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Export public key as SPKI
  const publicKeySpki = await crypto.subtle.exportKey(
    'spki',
    encryptionKeyPair.publicKey
  );

  // Export private key as PKCS8
  const privateKeyPkcs8 = await crypto.subtle.exportKey(
    'pkcs8',
    encryptionKeyPair.privateKey
  );

  const publicKeyPem = spkiToPem(publicKeySpki);
  const privateKeyPem = pkcs8ToPem(privateKeyPkcs8);

  return {
    publicKey: encryptionKeyPair.publicKey,
    privateKey: encryptionKeyPair.privateKey,
    publicKeyPem,
    privateKeyPem,
  };
}

/**
 * Encrypt private key with password-derived key
 */
export async function encryptPrivateKey(
  privateKeyPem: string,
  password: string,
  salt: string
): Promise<string> {
  const encryptionKey = await deriveEncryptionKey(password, salt);

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the private key PEM
  const encoder = new TextEncoder();
  const privateKeyBytes = encoder.encode(privateKeyPem);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    privateKeyBytes
  );

  // Combine IV and ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayToBase64(combined);
}

/**
 * Decrypt private key with password-derived key
 */
export async function decryptPrivateKey(
  encryptedPrivateKey: string,
  password: string,
  salt: string
): Promise<CryptoKey> {
  const encryptionKey = await deriveEncryptionKey(password, salt);

  // Split IV and ciphertext
  const combined = base64ToArray(encryptedPrivateKey);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Decrypt
  const privateKeyBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    ciphertext
  );

  // Parse PEM and import key
  const decoder = new TextDecoder();
  const privateKeyPem = decoder.decode(privateKeyBytes);

  return importPrivateKey(privateKeyPem);
}

/**
 * Import public key from PEM
 */
export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');

  const binaryDer = base64ToArray(pemContents);

  return crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

/**
 * Import private key from PEM
 */
export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryDer = base64ToArray(pemContents);

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

/**
 * Import private key for signing (PSS)
 */
export async function importPrivateKeyForSigning(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryDer = base64ToArray(pemContents);

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSA-PSS',
      hash: 'SHA-256',
    },
    true,
    ['sign']
  );
}

/**
 * Import public key for verification (PSS)
 */
export async function importPublicKeyForVerification(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');

  const binaryDer = base64ToArray(pemContents);

  return crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-PSS',
      hash: 'SHA-256',
    },
    true,
    ['verify']
  );
}

// Helper functions for PEM conversion
function spkiToPem(spki: ArrayBuffer): string {
  const b64 = arrayToBase64(new Uint8Array(spki));
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

function pkcs8ToPem(pkcs8: ArrayBuffer): string {
  const b64 = arrayToBase64(new Uint8Array(pkcs8));
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
}

/**
 * Export private key to PEM (for re-encryption during migration)
 */
export async function exportPrivateKeyToPem(privateKey: CryptoKey): Promise<string> {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
  return pkcs8ToPem(pkcs8);
}
