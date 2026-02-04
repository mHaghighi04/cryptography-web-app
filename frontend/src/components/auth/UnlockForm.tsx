import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function UnlockForm() {
  const [password, setPassword] = useState('');
  const { unlock, logout, user, isLoading, error, clearError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await unlock(password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-2">Welcome back!</h2>
        <p className="text-center text-gray-600 mb-6">
          Enter your password to unlock your encrypted keys
        </p>

        {user && (
          <div className="mb-6 p-3 bg-blue-50 rounded-lg text-center">
            <span className="text-gray-600">Logged in as </span>
            <span className="font-semibold text-blue-600">{user.username}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-700 text-sm"
            disabled={isLoading}
          >
            Sign out and use a different account
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p className="font-medium mb-2">Why do I need to unlock?</p>
          <p>Your private encryption key is protected by your password. For security, it's never stored unencrypted.</p>
        </div>
      </div>
    </div>
  );
}
