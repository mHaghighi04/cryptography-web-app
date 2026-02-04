import { useState, useEffect } from 'react';
import { LoginForm, SignupForm } from './components/auth';
import { ChatWindow } from './components/chat';
import { useAuth, initializeAuth } from './hooks/useAuth';

// Keep-alive interval: ping backend every 5 minutes to prevent Render free tier spin-down
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes in ms

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

  // Keep-alive heartbeat to prevent backend from spinning down
  useEffect(() => {
    const pingBackend = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
        await fetch(`${backendUrl}/health`);
      } catch {
        // Ignore errors - just trying to keep server warm
      }
    };

    // Initial ping
    pingBackend();

    // Set up interval
    const interval = setInterval(pingBackend, KEEP_ALIVE_INTERVAL);

    return () => clearInterval(interval);
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
