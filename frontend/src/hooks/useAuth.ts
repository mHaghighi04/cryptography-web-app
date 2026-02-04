import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../services/api';
import {
  generateSalt,
  deriveKey,
  generateKeyPair,
  encryptPrivateKey,
} from '../services/crypto';
import { socketService } from '../services/socket';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  signup: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      signup: async (username: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // Generate salt and derive password hash
          const salt = generateSalt();
          const passwordHash = await deriveKey(password, salt);

          // Generate RSA key pair (still needed for user identity on server)
          const { publicKeyPem, privateKeyPem } = await generateKeyPair();

          // Encrypt private key with password (stored but not used for message encryption)
          const encryptedPrivateKey = await encryptPrivateKey(privateKeyPem, password, salt);

          // Register user
          const response = await authApi.signup({
            username,
            salt,
            password_hash: passwordHash,
            encrypted_private_key: encryptedPrivateKey,
            public_key: publicKeyPem,
          });

          // Store token in localStorage for API requests
          localStorage.setItem('accessToken', response.access_token);

          // Connect socket
          await socketService.connect(response.access_token);

          set({
            user: response.user,
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Signup failed',
          });
          throw error;
        }
      },

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // Get salt from server
          const initResponse = await authApi.loginInit(username);

          if (!initResponse.exists) {
            throw new Error('Invalid username or password');
          }

          // Derive password hash
          const passwordHash = await deriveKey(password, initResponse.salt);

          // Login
          const response = await authApi.login(username, passwordHash);

          // Store token in localStorage for API requests
          localStorage.setItem('accessToken', response.access_token);

          // Connect socket
          await socketService.connect(response.access_token);

          set({
            user: response.user,
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      logout: () => {
        socketService.disconnect();
        localStorage.removeItem('accessToken');

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Re-authenticate on page load if tokens exist
export async function initializeAuth(): Promise<void> {
  const state = useAuth.getState();
  if (state.accessToken && state.isAuthenticated) {
    // Restore token to localStorage
    localStorage.setItem('accessToken', state.accessToken);

    // Try to reconnect socket
    try {
      await socketService.connect(state.accessToken);
    } catch (error) {
      console.error('Failed to reconnect socket:', error);
      useAuth.getState().logout();
    }
  }
}
