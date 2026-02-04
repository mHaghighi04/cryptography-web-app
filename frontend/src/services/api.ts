import type { User, Conversation, Message, LoginResponse } from '../types';

// Use environment variable or default to relative path for local dev
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const API_BASE = `${BACKEND_URL}/api`;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('accessToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, error.detail || 'Request failed');
  }

  return response.json();
}

// Auth API
export const authApi = {
  async signup(data: {
    username: string;
    salt: string;
    password_hash: string;
    encrypted_private_key: string;
    public_key: string;
  }): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async loginInit(username: string): Promise<{ salt: string; exists: boolean }> {
    return request<{ salt: string; exists: boolean }>('/auth/login/init', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  },

  async login(username: string, password_hash: string): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password_hash }),
    });
  },

  async refresh(refresh_token: string): Promise<{ access_token: string; refresh_token: string }> {
    return request<{ access_token: string; refresh_token: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token }),
    });
  },
};

// Users API
export const usersApi = {
  async list(): Promise<User[]> {
    return request<User[]>('/users');
  },

  async search(query: string): Promise<User[]> {
    return request<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  },

  async getMe(): Promise<User> {
    return request<User>('/users/me');
  },

  async get(userId: string): Promise<User> {
    return request<User>(`/users/${userId}`);
  },

  async getPublicKey(userId: string): Promise<{ id: string; username: string; public_key: string }> {
    return request<{ id: string; username: string; public_key: string }>(
      `/users/${userId}/public-key`
    );
  },
};

// Conversations API
export const conversationsApi = {
  async list(): Promise<Conversation[]> {
    return request<Conversation[]>('/conversations');
  },

  async getOrCreate(userId: string): Promise<Conversation> {
    return request<Conversation>(`/conversations/with/${userId}`, {
      method: 'POST',
    });
  },

  async get(
    conversationId: string,
    limit = 50,
    offset = 0
  ): Promise<Conversation & { messages: Message[] }> {
    return request<Conversation & { messages: Message[] }>(
      `/conversations/${conversationId}?limit=${limit}&offset=${offset}`
    );
  },

  async sendMessage(
    conversationId: string,
    content: string
  ): Promise<Message> {
    return request<Message>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};

export { ApiError };
