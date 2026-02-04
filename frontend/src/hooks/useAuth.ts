import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../services/api';
import {
  generateSalt,
  deriveKey,
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  exportPrivateKeyToPem,
} from '../services/crypto';
import { socketService } from '../services/socket';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  privateKey: CryptoKey | null;
  privateKeyPem: string | null;
  salt: string | null;
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
      privateKey: null,
      privateKeyPem: null,
      salt: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      signup: async (username: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // Generate salt and derive password hash
          const salt = generateSalt();
          const passwordHash = await deriveKey(password, salt);

          // Generate RSA key pair
          const { publicKeyPem, privateKeyPem } = await generateKeyPair();

          // Encrypt private key with password
          const encryptedPrivateKey = await encryptPrivateKey(privateKeyPem, password, salt);

          // Register user
          const response = await authApi.signup({
            username,
            salt,
            password_hash: passwordHash,
            encrypted_private_key: encryptedPrivateKey,
            public_key: publicKeyPem,
          });

          // Store tokens
          localStorage.setItem('accessToken', response.access_token);
          localStorage.setItem('refreshToken', response.refresh_token);

          // Decrypt private key for use
          const privateKey = await decryptPrivateKey(encryptedPrivateKey, password, salt);

          // Connect socket
          await socketService.connect(response.access_token);

          set({
            user: response.user,
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            privateKey,
            privateKeyPem,
            salt,
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

          // Store tokens
          localStorage.setItem('accessToken', response.access_token);
          localStorage.setItem('refreshToken', response.refresh_token);

          // Decrypt private key
          const privateKey = await decryptPrivateKey(
            response.encrypted_private_key,
            password,
            initResponse.salt
          );

          // Export to PEM for encryption operations
          const privateKeyPem = await exportPrivateKeyToPem(privateKey);

          // Connect socket
          await socketService.connect(response.access_token);

          set({
            user: response.user,
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            privateKey,
            privateKeyPem,
            salt: initResponse.salt,
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
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        socketService.disconnect();

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          privateKey: null,
          privateKeyPem: null,
          salt: null,
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
        // Only persist non-sensitive data
        // Private key and tokens are handled separately
        user: state.user,
        salt: state.salt,
      }),
    }
  )
);

// Re-authenticate on page load if tokens exist
export async function initializeAuth(): Promise<void> {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    try {
      await socketService.connect(accessToken);
    } catch (error) {
      console.error('Failed to reconnect socket:', error);
      // Token might be expired, let user re-login
      useAuth.getState().logout();
    }
  }
}
