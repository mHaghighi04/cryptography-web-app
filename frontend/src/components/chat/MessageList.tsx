import { useEffect, useRef } from 'react';
import type { Message } from '../../types';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';

export function MessageList() {
  const { messages, typingUsers, currentConversation, isLoading } = useChat();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="mt-4 text-lg font-medium">Select a conversation</p>
          <p className="mt-1">Choose a conversation from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    );
  }

  const typingUserNames = Array.from(typingUsers.values());

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-lg font-medium">No messages yet</p>
            <p className="mt-1">Send a message to start the conversation</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isMine={message.sender_id === user?.id}
            />
          ))}
        </div>
      )}

      {/* Typing indicator */}
      {typingUserNames.length > 0 && (
        <div className="mt-4 text-gray-500 text-sm italic">
          {typingUserNames.join(', ')} {typingUserNames.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
}

function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Signature verification status indicator
  const getSignatureIcon = () => {
    if (!message.signature) {
      // No signature - show nothing or a neutral indicator
      return null;
    }
    if (message.signature_verified === true) {
      return (
        <span
          className={`text-xs ${isMine ? 'text-green-200' : 'text-green-500'}`}
          title="Signature verified"
        >
          ✓
        </span>
      );
    }
    if (message.signature_verified === false) {
      return (
        <span
          className="text-xs text-red-500"
          title={message.signature_verification_error || 'Signature invalid'}
        >
          ⚠
        </span>
      );
    }
    // Verification in progress or unknown
    return null;
  };

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${
          isMine ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 shadow'
        } ${message.signature_verified === false ? 'ring-2 ring-red-300' : ''}`}
      >
        <div className="break-words">{message.content}</div>
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-xs ${
            isMine ? 'text-blue-100' : 'text-gray-400'
          }`}
        >
          {getSignatureIcon()}
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}
