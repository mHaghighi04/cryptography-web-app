import { useState, useEffect } from 'react';
import { LoginForm, SignupForm } from './components/auth';
import { ChatWindow } from './components/chat';
import { useAuth, initializeAuth } from './hooks/useAuth';

function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const { isAuthenticated, isLoading } = useAuth();

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

  if (isAuthenticated) {
    return <ChatWindow />;
  }

  if (authMode === 'login') {
    return <LoginForm onSwitchToSignup={() => setAuthMode('signup')} />;
  }

  return <SignupForm onSwitchToLogin={() => setAuthMode('login')} />;
}

export default App;
