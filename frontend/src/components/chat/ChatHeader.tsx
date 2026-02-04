import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';

export function ChatHeader() {
  const { currentConversation, onlineUsers } = useChat();
  const { logout, user } = useAuth();

  const participant = currentConversation?.other_participant;
  const isOnline = participant ? onlineUsers.has(participant.id) : false;

  return (
    <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        {participant ? (
          <>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                {participant.username[0].toUpperCase()}
              </div>
              {isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            <div className="ml-3">
              <div className="font-medium text-gray-800">{participant.username}</div>
              <div className="text-sm text-gray-500">
                {isOnline ? (
                  <span className="text-green-500">Online</span>
                ) : (
                  'Offline'
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="font-medium text-gray-800">Crypto Chat</div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="text-sm text-gray-600">
            Logged in as <span className="font-medium">{user.username}</span>
          </div>
        )}
        <button
          onClick={logout}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
