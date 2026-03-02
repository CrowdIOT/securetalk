import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';

function AppContent() {
  const { user, loading, connectionError } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-gradient-orbs" />
        <div className="relative z-10 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4 lock-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-light to-purple-400 bg-clip-text text-transparent mb-2">
            SecureTalk
          </h1>
          <p className="text-dark-300 text-sm">Loading secure session...</p>
        </div>
      </div>
    );
  }

  if (connectionError && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-gradient-orbs" />
        <div className="relative z-10 glass rounded-2xl p-8 max-w-md text-center">
          <div className="text-danger text-lg font-semibold mb-2">Connection Error</div>
          <p className="text-dark-200 text-sm mb-4">
            Could not connect to the server. Please check that the Supabase environment variables are set correctly.
          </p>
          <p className="text-dark-400 text-xs mb-4 font-mono break-all">
            URL: {import.meta.env.VITE_SUPABASE_URL || '(not set)'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return user ? <ChatPage /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
