export interface User {
  id: string;
  username: string;
  public_key: string;
  is_online: boolean;
  created_at: string;
  last_seen: string;
}

export interface Conversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  created_at: string;
  updated_at: string;
  other_participant?: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  ciphertext: string;
  nonce: string;
  signature: string;
  encrypted_key_sender: string;
  encrypted_key_recipient: string;
  cipher_type: string;
  created_at: string;
}

export interface DecryptedMessage extends Message {
  plaintext: string;
  verified: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
  encrypted_private_key: string;
  requires_key_migration: boolean;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  privateKey: CryptoKey | null;
  publicKey: CryptoKey | null;
  isAuthenticated: boolean;
}
