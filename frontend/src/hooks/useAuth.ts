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
  encryptedPrivateKey: string | null;
  privateKey: CryptoKey | null;
  privateKeyPem: string | null;
  salt: string | null;
  isAuthenticated: boolean;
  needsUnlock: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  signup: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      encryptedPrivateKey: null,
      privateKey: null,
      privateKeyPem: null,
      salt: null,
      isAuthenticated: false,
      needsUnlock: false,
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

          // Decrypt private key for use
          const privateKey = await decryptPrivateKey(encryptedPrivateKey, password, salt);

          // Connect socket
          await socketService.connect(response.access_token);

          set({
            user: response.user,
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            encryptedPrivateKey,
            privateKey,
            privateKeyPem,
            salt,
            isAuthenticated: true,
            needsUnlock: false,
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
            encryptedPrivateKey: response.encrypted_private_key,
            privateKey,
            privateKeyPem,
            salt: initResponse.salt,
            isAuthenticated: true,
            needsUnlock: false,
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

      unlock: async (password: string) => {
        const { encryptedPrivateKey, salt, accessToken } = get();

        if (!encryptedPrivateKey || !salt || !accessToken) {
          set({ error: 'Session expired. Please login again.' });
          get().logout();
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Decrypt private key
          const privateKey = await decryptPrivateKey(encryptedPrivateKey, password, salt);

          // Export to PEM for encryption operations
          const privateKeyPem = await exportPrivateKeyToPem(privateKey);

          // Reconnect socket
          await socketService.connect(accessToken);

          set({
            privateKey,
            privateKeyPem,
            needsUnlock: false,
            isLoading: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: 'Invalid password',
          });
        }
      },

      logout: () => {
        socketService.disconnect();

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          encryptedPrivateKey: null,
          privateKey: null,
          privateKeyPem: null,
          salt: null,
          isAuthenticated: false,
          needsUnlock: false,
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
        encryptedPrivateKey: state.encryptedPrivateKey,
        salt: state.salt,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrate: () => {
        return (state) => {
          // After rehydration, if user is authenticated but no private key, they need to unlock
          if (state?.isAuthenticated && !state?.privateKey) {
            state.needsUnlock = true;
          }
        };
      },
    }
  )
);

// Re-authenticate on page load if tokens exist
export async function initializeAuth(): Promise<void> {
  const state = useAuth.getState();
  if (state.accessToken && state.isAuthenticated) {
    if (!state.privateKey) {
      // User needs to unlock with password
      useAuth.setState({ needsUnlock: true });
    } else {
      // Try to reconnect socket
      try {
        await socketService.connect(state.accessToken);
      } catch (error) {
        console.error('Failed to reconnect socket:', error);
        useAuth.getState().logout();
      }
    }
  }
}
