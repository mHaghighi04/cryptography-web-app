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
  content: string;  // Plaintext from server
  created_at: string;
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
  isAuthenticated: boolean;
}
