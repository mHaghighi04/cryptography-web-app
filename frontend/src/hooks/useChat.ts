import { create } from 'zustand';
import type { Conversation, Message, DecryptedMessage, User } from '../types';
import { conversationsApi, usersApi } from '../services/api';
import { socketService } from '../services/socket';
import { encryptMessage, decryptMessage } from '../services/crypto';
import { useAuth } from './useAuth';

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: DecryptedMessage[];
  typingUsers: Map<string, string>; // conversation_id -> username
  onlineUsers: Set<string>;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadConversations: () => Promise<void>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  startConversation: (userId: string) => Promise<void>;
  sendMessage: (plaintext: string) => Promise<void>;
  clearError: () => void;
}

export const useChat = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  typingUsers: new Map(),
  onlineUsers: new Set(),
  isLoading: false,
  error: null,

  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const conversations = await conversationsApi.list();
      set({ conversations, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversations',
      });
    }
  },

  selectConversation: async (conversation: Conversation) => {
    const { currentConversation } = get();

    // Leave previous conversation room
    if (currentConversation) {
      await socketService.leaveConversation(currentConversation.id);
    }

    set({ isLoading: true, error: null, currentConversation: conversation, messages: [] });

    try {
      // Join new conversation room
      await socketService.joinConversation(conversation.id);

      // Load messages
      const fullConversation = await conversationsApi.get(conversation.id);

      // Decrypt messages
      const auth = useAuth.getState();
      const decryptedMessages: DecryptedMessage[] = [];

      for (const msg of fullConversation.messages) {
        try {
          const decrypted = await decryptMessageForUser(msg, auth);
          decryptedMessages.push(decrypted);
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          decryptedMessages.push({
            ...msg,
            plaintext: '[Failed to decrypt]',
            verified: false,
          });
        }
      }

      set({ messages: decryptedMessages, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversation',
      });
    }
  },

  startConversation: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const conversation = await conversationsApi.getOrCreate(userId);
      const { conversations } = get();

      // Add to list if not already there
      if (!conversations.find((c) => c.id === conversation.id)) {
        set({ conversations: [conversation, ...conversations] });
      }

      // Select the conversation
      await get().selectConversation(conversation);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start conversation',
      });
    }
  },

  sendMessage: async (plaintext: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    const auth = useAuth.getState();
    if (!auth.user || !auth.privateKeyPem) {
      set({ error: 'Not authenticated' });
      return;
    }

    try {
      // Get recipient's public key
      const otherParticipantId =
        currentConversation.participant1_id === auth.user.id
          ? currentConversation.participant2_id
          : currentConversation.participant1_id;

      const recipientKeyData = await usersApi.getPublicKey(otherParticipantId);

      // Encrypt message
      const encrypted = await encryptMessage(
        plaintext,
        auth.privateKeyPem,
        auth.user.public_key,
        recipientKeyData.public_key
      );

      // Send via Socket.IO
      const result = await socketService.sendMessage({
        conversation_id: currentConversation.id,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        signature: encrypted.signature,
        encrypted_key_sender: encrypted.encryptedKeySender,
        encrypted_key_recipient: encrypted.encryptedKeyRecipient,
        cipher_type: 'aes-256-gcm',
      });

      if (result.error) {
        set({ error: result.error });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  },

  clearError: () => set({ error: null }),
}));

// Helper function to decrypt a message
async function decryptMessageForUser(
  msg: Message,
  auth: { user: User | null; privateKey: CryptoKey | null }
): Promise<DecryptedMessage> {
  if (!auth.user || !auth.privateKey) {
    throw new Error('Not authenticated');
  }

  // Determine which encrypted key to use
  const isSender = msg.sender_id === auth.user.id;
  const encryptedKey = isSender ? msg.encrypted_key_sender : msg.encrypted_key_recipient;

  // Get sender's public key for signature verification
  let senderPublicKey: string;
  if (isSender) {
    senderPublicKey = auth.user.public_key;
  } else {
    const senderData = await usersApi.getPublicKey(msg.sender_id);
    senderPublicKey = senderData.public_key;
  }

  const { plaintext, verified } = await decryptMessage(
    msg.ciphertext,
    msg.nonce,
    msg.signature,
    encryptedKey,
    auth.privateKey,
    senderPublicKey
  );

  return {
    ...msg,
    plaintext,
    verified,
  };
}

// Initialize socket event handlers
export function initializeChatSocket() {
  // Handle new messages
  socketService.onMessage(async (message) => {
    const { currentConversation, messages } = useChat.getState();
    const auth = useAuth.getState();

    // Only process if in the same conversation
    if (currentConversation?.id === message.conversation_id) {
      try {
        const decrypted = await decryptMessageForUser(message, auth);

        // Check if message already exists (avoid duplicates)
        if (!messages.find((m) => m.id === message.id)) {
          useChat.setState({ messages: [...messages, decrypted] });
        }
      } catch (error) {
        console.error('Failed to decrypt new message:', error);
      }
    }

    // Reload conversations to update order
    useChat.getState().loadConversations();
  });

  // Handle typing indicators
  socketService.onTyping(({ user_id, username }) => {
    const { currentConversation, typingUsers } = useChat.getState();
    if (currentConversation) {
      const newTypingUsers = new Map(typingUsers);
      newTypingUsers.set(user_id, username);
      useChat.setState({ typingUsers: newTypingUsers });
    }
  });

  socketService.onStopTyping(({ user_id }) => {
    const { typingUsers } = useChat.getState();
    const newTypingUsers = new Map(typingUsers);
    newTypingUsers.delete(user_id);
    useChat.setState({ typingUsers: newTypingUsers });
  });

  // Handle presence
  socketService.onUserOnline(({ user_id }) => {
    const { onlineUsers } = useChat.getState();
    const newOnlineUsers = new Set(onlineUsers);
    newOnlineUsers.add(user_id);
    useChat.setState({ onlineUsers: newOnlineUsers });
  });

  socketService.onUserOffline(({ user_id }) => {
    const { onlineUsers } = useChat.getState();
    const newOnlineUsers = new Set(onlineUsers);
    newOnlineUsers.delete(user_id);
    useChat.setState({ onlineUsers: newOnlineUsers });
  });
}
