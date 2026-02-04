import { create } from 'zustand';
import type { Conversation, Message } from '../types';
import { conversationsApi } from '../services/api';
import { socketService } from '../services/socket';
import { useAuth } from './useAuth';

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  typingUsers: Map<string, string>; // user_id -> username
  onlineUsers: Set<string>;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadConversations: () => Promise<void>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  startConversation: (userId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
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

      // Load messages (already decrypted by server)
      const fullConversation = await conversationsApi.get(conversation.id);

      set({ messages: fullConversation.messages, isLoading: false });
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

  sendMessage: async (content: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    const auth = useAuth.getState();
    if (!auth.user) {
      set({ error: 'Not authenticated' });
      return;
    }

    try {
      // Send plaintext via Socket.IO - server will encrypt
      const result = await socketService.sendMessage({
        conversation_id: currentConversation.id,
        content,
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

// Initialize socket event handlers
export function initializeChatSocket() {
  // Handle new messages (already decrypted by server)
  socketService.onMessage((message) => {
    const { currentConversation, messages } = useChat.getState();

    // Only process if in the same conversation
    if (currentConversation?.id === message.conversation_id) {
      // Check if message already exists (avoid duplicates)
      if (!messages.find((m) => m.id === message.id)) {
        useChat.setState({ messages: [...messages, message] });
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
