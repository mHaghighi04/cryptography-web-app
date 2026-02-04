import { useState, useEffect } from 'react';
import { LoginForm, SignupForm, UnlockForm } from './components/auth';
import { ChatWindow } from './components/chat';
import { useAuth, initializeAuth } from './hooks/useAuth';

function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const { isAuthenticated, needsUnlock, isLoading } = useAuth();

  useEffect(() => {
    initializeAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // User is authenticated but needs to unlock their private key
  if (isAuthenticated && needsUnlock) {
    return <UnlockForm />;
  }

  // User is fully authenticated
  if (isAuthenticated) {
    return <ChatWindow />;
  }

  // User needs to login or signup
  if (authMode === 'login') {
    return <LoginForm onSwitchToSignup={() => setAuthMode('signup')} />;
  }

  return <SignupForm onSwitchToLogin={() => setAuthMode('login')} />;
}

export default App;
