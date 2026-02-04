import { arrayToHex, hexToArray, arrayToBase64, base64ToArray } from './kdf';
import {
  importPublicKey,
  importPrivateKeyForSigning,
  importPublicKeyForVerification,
} from './keyGeneration';

/**
 * Generate a random symmetric key for AES-256-GCM
 */
async function generateSymmetricKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a message using hybrid encryption
 * 1. Generate random AES-256-GCM key
 * 2. Encrypt message with AES-GCM
 * 3. Encrypt AES key with recipient's RSA public key
 * 4. Sign (nonce + ciphertext) with sender's RSA private key
 */
export async function encryptMessage(
  plaintext: string,
  senderPrivateKeyPem: string,
  senderPublicKeyPem: string,
  recipientPublicKeyPem: string
): Promise<{
  ciphertext: string;
  nonce: string;
  signature: string;
  encryptedKeySender: string;
  encryptedKeyRecipient: string;
}> {
  // Generate symmetric key
  const symmetricKey = await generateSymmetricKey();

  // Generate nonce (12 bytes for AES-GCM)
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt message
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    symmetricKey,
    plaintextBytes
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // Export symmetric key for wrapping
  const rawKey = await crypto.subtle.exportKey('raw', symmetricKey);
  const rawKeyBytes = new Uint8Array(rawKey);

  // Encrypt symmetric key for sender
  const senderPublicKey = await importPublicKey(senderPublicKeyPem);
  const encryptedKeySenderBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    senderPublicKey,
    rawKeyBytes
  );
  const encryptedKeySender = arrayToBase64(new Uint8Array(encryptedKeySenderBuffer));

  // Encrypt symmetric key for recipient
  const recipientPublicKey = await importPublicKey(recipientPublicKeyPem);
  const encryptedKeyRecipientBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    rawKeyBytes
  );
  const encryptedKeyRecipient = arrayToBase64(new Uint8Array(encryptedKeyRecipientBuffer));

  // Sign (nonce + ciphertext)
  const dataToSign = new Uint8Array(nonce.length + ciphertext.length);
  dataToSign.set(nonce);
  dataToSign.set(ciphertext, nonce.length);

  const signingKey = await importPrivateKeyForSigning(senderPrivateKeyPem);
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    signingKey,
    dataToSign
  );
  const signature = arrayToBase64(new Uint8Array(signatureBuffer));

  return {
    ciphertext: arrayToHex(ciphertext),
    nonce: arrayToHex(nonce),
    signature,
    encryptedKeySender,
    encryptedKeyRecipient,
  };
}

/**
 * Decrypt a message and verify signature
 */
export async function decryptMessage(
  ciphertextHex: string,
  nonceHex: string,
  signature: string,
  encryptedKey: string, // The appropriate key (sender or recipient)
  privateKey: CryptoKey,
  senderPublicKeyPem: string
): Promise<{ plaintext: string; verified: boolean }> {
  const ciphertext = hexToArray(ciphertextHex);
  const nonce = hexToArray(nonceHex);
  const signatureBytes = base64ToArray(signature);
  const encryptedKeyBytes = base64ToArray(encryptedKey);

  // Decrypt the symmetric key using RSA-OAEP
  const rawKeyBuffer = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedKeyBytes.buffer as ArrayBuffer
  );

  // Import symmetric key
  const symmetricKey = await crypto.subtle.importKey(
    'raw',
    rawKeyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt message
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    symmetricKey,
    ciphertext.buffer as ArrayBuffer
  );

  const decoder = new TextDecoder();
  const plaintext = decoder.decode(plaintextBuffer);

  // Verify signature
  const dataToVerify = new Uint8Array(nonce.length + ciphertext.length);
  dataToVerify.set(nonce);
  dataToVerify.set(ciphertext, nonce.length);

  const verificationKey = await importPublicKeyForVerification(senderPublicKeyPem);
  const verified = await crypto.subtle.verify(
    { name: 'RSA-PSS', saltLength: 32 },
    verificationKey,
    signatureBytes.buffer as ArrayBuffer,
    dataToVerify.buffer as ArrayBuffer
  );

  return { plaintext, verified };
}

/**
 * Decrypt message as sender (uses encryptedKeySender)
 */
export async function decryptMessageAsSender(
  ciphertextHex: string,
  nonceHex: string,
  signature: string,
  encryptedKeySender: string,
  privateKey: CryptoKey,
  senderPublicKeyPem: string
): Promise<{ plaintext: string; verified: boolean }> {
  return decryptMessage(
    ciphertextHex,
    nonceHex,
    signature,
    encryptedKeySender,
    privateKey,
    senderPublicKeyPem
  );
}

/**
 * Decrypt message as recipient (uses encryptedKeyRecipient)
 */
export async function decryptMessageAsRecipient(
  ciphertextHex: string,
  nonceHex: string,
  signature: string,
  encryptedKeyRecipient: string,
  privateKey: CryptoKey,
  senderPublicKeyPem: string
): Promise<{ plaintext: string; verified: boolean }> {
  return decryptMessage(
    ciphertextHex,
    nonceHex,
    signature,
    encryptedKeyRecipient,
    privateKey,
    senderPublicKeyPem
  );
}
