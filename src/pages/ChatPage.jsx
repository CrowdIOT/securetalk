import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useKeyManager } from '../hooks/useKeyManager';
import UserList from '../components/UserList';
import ChatWindow from '../components/ChatWindow';

export default function ChatPage() {
    const { user, signOut } = useAuth();
    const { privateKey, keysReady, error: keyError } = useKeyManager(user);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showEncrypted, setShowEncrypted] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    if (!keysReady && !keyError) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="bg-gradient-orbs" />
                <div className="relative z-10 text-center animate-fade-in">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4">
                        <svg className="animate-spin h-8 w-8 text-accent-light" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                    <p className="text-dark-200">Initializing encryption keys...</p>
                    <p className="text-dark-300 text-sm mt-1">Generating secure key pair</p>
                </div>
            </div>
        );
    }

    if (keyError) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-gradient-orbs" />
                <div className="relative z-10 glass rounded-2xl p-8 max-w-md text-center">
                    <div className="text-danger text-lg font-semibold mb-2">Encryption Error</div>
                    <p className="text-dark-200 text-sm">{keyError}</p>
                    <button onClick={signOut} className="btn-primary mt-4">Sign Out</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            <div className="bg-gradient-orbs" />

            {/* Header */}
            <header className="relative z-10 glass border-b border-accent/10 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    {/* Mobile sidebar toggle */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden p-2 rounded-lg hover:bg-dark-600 transition-colors"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-2">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light lock-icon">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <h1 className="text-lg font-bold bg-gradient-to-r from-accent-light to-purple-400 bg-clip-text text-transparent">
                            SecureTalk
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Demo toggle: show encrypted */}
                    <label className="flex items-center gap-2 cursor-pointer select-none" title="Toggle to see raw encrypted data">
                        <span className="text-xs text-dark-200 hidden sm:inline">Show Encrypted</span>
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={showEncrypted}
                                onChange={() => setShowEncrypted(!showEncrypted)}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-dark-500 rounded-full peer peer-checked:bg-accent transition-colors" />
                            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                        </div>
                    </label>

                    {/* User info & sign out */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent-light text-sm font-semibold">
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="text-sm text-dark-200 hidden md:inline max-w-[120px] truncate">
                            {user?.email}
                        </span>
                        <button
                            onClick={signOut}
                            className="p-2 rounded-lg hover:bg-dark-600 transition-colors text-dark-200 hover:text-danger"
                            title="Sign out"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="relative z-10 flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 transition-transform duration-300
          absolute lg:relative z-20 w-72 lg:w-80 h-full
          glass border-r border-accent/10
          flex flex-col shrink-0
        `}>
                    <UserList
                        currentUser={user}
                        selectedUser={selectedUser}
                        onSelectUser={(u) => {
                            setSelectedUser(u);
                            setSidebarOpen(false); // close on mobile
                        }}
                    />
                </aside>

                {/* Chat area */}
                <main className="flex-1 flex flex-col min-w-0">
                    {selectedUser ? (
                        <ChatWindow
                            currentUser={user}
                            selectedUser={selectedUser}
                            privateKey={privateKey}
                            showEncrypted={showEncrypted}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center animate-fade-in">
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent/5 mb-4">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-dark-400">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-semibold text-dark-300 mb-1">Select a conversation</h2>
                                <p className="text-sm text-dark-400">Choose a user to start an encrypted chat</p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
