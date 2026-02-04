"""Server-side cryptography utilities."""

import os
import base64
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

# Server encryption key - in production, load from environment variable
SERVER_KEY = os.environ.get('ENCRYPTION_KEY', 'default-dev-key-change-in-prod')


def get_encryption_key() -> bytes:
    """Derive a 256-bit key from the server key."""
    kdf = Scrypt(
        salt=b'crypto-chat-salt',
        length=32,
        n=2**14,
        r=8,
        p=1,
    )
    return kdf.derive(SERVER_KEY.encode())


def encrypt_message(plaintext: str) -> Tuple[str, str]:
    """
    Encrypt a message using AES-256-GCM.
    Returns (ciphertext_b64, nonce_b64).
    """
    key = get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)

    ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)

    return (
        base64.b64encode(ciphertext).decode('utf-8'),
        base64.b64encode(nonce).decode('utf-8')
    )


def decrypt_message(ciphertext_b64: str, nonce_b64: str) -> str:
    """
    Decrypt a message using AES-256-GCM.
    Returns the plaintext string.
    """
    key = get_encryption_key()
    aesgcm = AESGCM(key)

    ciphertext = base64.b64decode(ciphertext_b64)
    nonce = base64.b64decode(nonce_b64)

    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode('utf-8')
