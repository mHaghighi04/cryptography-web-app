import { useEffect } from 'react';
import { ConversationList } from './ConversationList';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
import { initializeChatSocket } from '../../hooks/useChat';

export function ChatWindow() {
  useEffect(() => {
    initializeChatSocket();
  }, []);

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar */}
      <ConversationList />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <ChatHeader />
        <MessageList />
        <MessageInput />
      </div>
    </div>
  );
}
