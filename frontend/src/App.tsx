import { useState, useEffect } from 'react';
import { LoginForm, SignupForm } from './components/auth';
import { ChatWindow } from './components/chat';
import { useAuth, initializeAuth } from './hooks/useAuth';

function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isInitializing, setIsInitializing] = useState(true);
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const init = async () => {
      await initializeAuth();
      setIsInitializing(false);
    };
    init();
  }, []);

  // Show loading while initializing auth or during auth operations
  if (isInitializing || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
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
