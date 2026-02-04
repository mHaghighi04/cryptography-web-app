import { useEffect, useState } from 'react';
import type { Conversation, User } from '../../types';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { usersApi } from '../../services/api';

export function ConversationList() {
  const {
    conversations,
    currentConversation,
    loadConversations,
    selectConversation,
    startConversation,
    onlineUsers,
  } = useChat();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 1) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await usersApi.search(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSelectUser = async (selectedUser: User) => {
    setSearchQuery('');
    setSearchResults([]);
    await startConversation(selectedUser.id);
  };

  return (
    <div className="w-80 bg-white border-r flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">Messages</h2>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="border-b bg-gray-50">
          <div className="p-2 text-sm text-gray-500">Search Results</div>
          {searchResults.map((searchUser) => (
            <button
              key={searchUser.id}
              onClick={() => handleSelectUser(searchUser)}
              className="w-full p-3 flex items-center hover:bg-gray-100 transition"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                {searchUser.username[0].toUpperCase()}
              </div>
              <div className="ml-3 flex-1 text-left">
                <div className="font-medium text-gray-800">{searchUser.username}</div>
                <div className="text-sm text-gray-500">
                  {onlineUsers.has(searchUser.id) ? (
                    <span className="text-green-500">Online</span>
                  ) : (
                    'Offline'
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No conversations yet</p>
            <p className="text-sm mt-2">Search for users to start chatting</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={currentConversation?.id === conv.id}
              isOnline={conv.other_participant ? onlineUsers.has(conv.other_participant.id) : false}
              onClick={() => selectConversation(conv)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isOnline: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, isOnline, onClick }: ConversationItemProps) {
  const participant = conversation.other_participant;
  if (!participant) return null;

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-center transition ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-lg">
          {participant.username[0].toUpperCase()}
        </div>
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
        )}
      </div>
      <div className="ml-3 flex-1 text-left">
        <div className="font-medium text-gray-800">{participant.username}</div>
        <div className="text-sm text-gray-500 truncate">
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
    </button>
  );
}
