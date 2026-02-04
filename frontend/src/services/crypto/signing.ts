/**
 * RSA-PSS digital signature utilities for message authentication.
 * Compatible with the CLI reference implementation.
 */

import { arrayToBase64, base64ToArray } from './kdf';
import { importPrivateKeyForSigning, importPublicKeyForVerification } from './keyGeneration';
import { getPublicKeyFromCertificate } from './csr';

/**
 * Sign a message using RSA-PSS with SHA-256.
 * Signs the content directly (matching CLI implementation which signs nonce + ciphertext).
 *
 * @param content - The message content to sign
 * @param privateKeyPem - PEM-encoded RSA private key
 * @returns Base64-encoded signature
 */
export async function signMessage(
  content: string,
  privateKeyPem: string
): Promise<string> {
  const privateKey = await importPrivateKeyForSigning(privateKeyPem);
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  const signature = await crypto.subtle.sign(
    {
      name: 'RSA-PSS',
      saltLength: 32, // SHA-256 output length
    },
    privateKey,
    data
  );

  return arrayToBase64(new Uint8Array(signature));
}

/**
 * Verify a message signature using RSA-PSS with SHA-256.
 *
 * @param content - The message content that was signed
 * @param signatureBase64 - Base64-encoded signature
 * @param publicKeyPem - PEM-encoded RSA public key
 * @returns true if signature is valid
 */
export async function verifyMessageSignature(
  content: string,
  signatureBase64: string,
  publicKeyPem: string
): Promise<boolean> {
  try {
    const publicKey = await importPublicKeyForVerification(publicKeyPem);
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const signature = base64ToArray(signatureBase64);

    return await crypto.subtle.verify(
      {
        name: 'RSA-PSS',
        saltLength: 32,
      },
      publicKey,
      signature.buffer as ArrayBuffer,
      data
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Verify a message signature using the sender's certificate.
 *
 * @param content - The message content that was signed
 * @param signatureBase64 - Base64-encoded signature
 * @param senderCertPem - PEM-encoded sender's certificate
 * @returns true if signature is valid
 */
export async function verifyMessageSignatureWithCert(
  content: string,
  signatureBase64: string,
  senderCertPem: string
): Promise<boolean> {
  try {
    const publicKeyPem = getPublicKeyFromCertificate(senderCertPem);
    return await verifyMessageSignature(content, signatureBase64, publicKeyPem);
  } catch (error) {
    console.error('Certificate-based signature verification failed:', error);
    return false;
  }
}
