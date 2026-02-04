export interface User {
  id: string;
  username: string;
  public_key: string;
  is_online: boolean;
  created_at: string;
  last_seen: string;
  certificate_status?: CertificateStatus;
  certificate?: string;
}

export type CertificateStatus = 'none' | 'pending' | 'active' | 'expired' | 'revoked';

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
  content: string;  // Plaintext from server
  created_at: string;
  // Digital signature fields
  signature?: string;  // RSA-PSS signature (base64)
  encrypted_key_sender?: string;  // RSA-OAEP wrapped key for sender
  encrypted_key_recipient?: string;  // RSA-OAEP wrapped key for recipient
  // Client-side verification status
  signature_verified?: boolean;
  signature_verification_error?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
  encrypted_private_key: string;
  requires_key_migration: boolean;
  certificate_status: CertificateStatus;
  certificate?: string;
}

export interface CertificateStatusResponse {
  status: CertificateStatus;
  expires_at?: string;
  serial?: string;
  subject?: string;
}

export interface UserCertificateResponse {
  user_id: string;
  username: string;
  certificate: string;
  status: CertificateStatus;
  expires_at?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}
