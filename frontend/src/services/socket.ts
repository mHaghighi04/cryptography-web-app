import { io, Socket } from 'socket.io-client';
import type { Message } from '../types';

// Use environment variable or default for local dev
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

type MessageCallback = (message: Message) => void;
type TypingCallback = (data: { user_id: string; username: string }) => void;
type PresenceCallback = (data: { user_id: string; username: string }) => void;
type NotificationCallback = (data: {
  conversation_id: string;
  sender_id: string;
  sender_username: string;
}) => void;

class SocketService {
  private socket: Socket | null = null;
  private messageCallbacks: Set<MessageCallback> = new Set();
  private typingCallbacks: Set<TypingCallback> = new Set();
  private stopTypingCallbacks: Set<TypingCallback> = new Set();
  private onlineCallbacks: Set<PresenceCallback> = new Set();
  private offlineCallbacks: Set<PresenceCallback> = new Set();
  private notificationCallbacks: Set<NotificationCallback> = new Set();

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(BACKEND_URL || window.location.origin, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('Socket connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      // Message events
      this.socket.on('new_message', (message: Message) => {
        this.messageCallbacks.forEach((cb) => cb(message));
      });

      // Typing events
      this.socket.on('user_typing', (data: { user_id: string; username: string }) => {
        this.typingCallbacks.forEach((cb) => cb(data));
      });

      this.socket.on('user_stopped_typing', (data: { user_id: string; username: string }) => {
        this.stopTypingCallbacks.forEach((cb) => cb(data));
      });

      // Presence events
      this.socket.on('user_online', (data: { user_id: string; username: string }) => {
        this.onlineCallbacks.forEach((cb) => cb(data));
      });

      this.socket.on('user_offline', (data: { user_id: string; username: string }) => {
        this.offlineCallbacks.forEach((cb) => cb(data));
      });

      // Notification events
      this.socket.on(
        'message_notification',
        (data: { conversation_id: string; sender_id: string; sender_username: string }) => {
          this.notificationCallbacks.forEach((cb) => cb(data));
        }
      );
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  async joinConversation(conversationId: string): Promise<{ success?: boolean; error?: string }> {
    if (!this.socket?.connected) {
      return { error: 'Not connected' };
    }
    return new Promise((resolve) => {
      this.socket!.emit(
        'join_conversation',
        { conversation_id: conversationId },
        (response: { success?: boolean; error?: string }) => {
          resolve(response);
        }
      );
    });
  }

  async leaveConversation(conversationId: string): Promise<void> {
    if (!this.socket?.connected) return;
    return new Promise((resolve) => {
      this.socket!.emit('leave_conversation', { conversation_id: conversationId }, () => {
        resolve();
      });
    });
  }

  async sendMessage(data: {
    conversation_id: string;
    content: string;
  }): Promise<{ success?: boolean; message_id?: string; error?: string }> {
    if (!this.socket?.connected) {
      return { error: 'Not connected' };
    }
    return new Promise((resolve) => {
      this.socket!.emit('send_message', data, (response: { success?: boolean; message_id?: string; error?: string }) => {
        resolve(response);
      });
    });
  }

  emitTyping(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('typing', { conversation_id: conversationId });
  }

  emitStopTyping(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('stop_typing', { conversation_id: conversationId });
  }

  async getOnlineUsers(): Promise<{ online_users: { user_id: string; username: string }[] }> {
    if (!this.socket?.connected) {
      return { online_users: [] };
    }
    return new Promise((resolve) => {
      this.socket!.emit(
        'get_online_users',
        {},
        (response: { online_users: { user_id: string; username: string }[] }) => {
          resolve(response);
        }
      );
    });
  }

  // Event listeners
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  onTyping(callback: TypingCallback): () => void {
    this.typingCallbacks.add(callback);
    return () => this.typingCallbacks.delete(callback);
  }

  onStopTyping(callback: TypingCallback): () => void {
    this.stopTypingCallbacks.add(callback);
    return () => this.stopTypingCallbacks.delete(callback);
  }

  onUserOnline(callback: PresenceCallback): () => void {
    this.onlineCallbacks.add(callback);
    return () => this.onlineCallbacks.delete(callback);
  }

  onUserOffline(callback: PresenceCallback): () => void {
    this.offlineCallbacks.add(callback);
    return () => this.offlineCallbacks.delete(callback);
  }

  onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.add(callback);
    return () => this.notificationCallbacks.delete(callback);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
