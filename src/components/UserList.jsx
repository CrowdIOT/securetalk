import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UserList({ currentUser, selectedUser, onSelectUser }) {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, [currentUser]);

    async function fetchUsers() {
        if (!currentUser) return;

        try {
            // Fetch all profiles except current user
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email')
                .neq('id', currentUser.id)
                .order('email');

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredUsers = users.filter((u) =>
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    // Generate a consistent color for each user avatar
    function getAvatarColor(email) {
        const colors = [
            'bg-indigo-500/20 text-indigo-400',
            'bg-emerald-500/20 text-emerald-400',
            'bg-amber-500/20 text-amber-400',
            'bg-rose-500/20 text-rose-400',
            'bg-cyan-500/20 text-cyan-400',
            'bg-violet-500/20 text-violet-400',
            'bg-orange-500/20 text-orange-400',
            'bg-teal-500/20 text-teal-400',
        ];
        let hash = 0;
        for (let i = 0; i < email.length; i++) {
            hash = email.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="p-4 border-b border-accent/10">
                <div className="relative">
                    <svg
                        width="16" height="16"
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-300"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-field pl-10 py-2.5 text-sm"
                    />
                </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto py-2">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin h-6 w-6 text-accent" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <p className="text-dark-400 text-sm">
                            {search ? 'No users found' : 'No other users yet'}
                        </p>
                        <p className="text-dark-500 text-xs mt-1">
                            {!search && 'Ask someone to create an account!'}
                        </p>
                    </div>
                ) : (
                    filteredUsers.map((u, index) => (
                        <button
                            key={u.id}
                            onClick={() => onSelectUser(u)}
                            className={`
                w-full px-4 py-3 flex items-center gap-3 transition-all duration-200
                hover:bg-accent/5
                ${selectedUser?.id === u.id ? 'bg-accent/10 border-r-2 border-accent' : ''}
                animate-slide-in-left
              `}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${getAvatarColor(u.email)}`}>
                                {u.email[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium text-dark-100 truncate">{u.email}</p>
                                <p className="text-xs text-dark-400 flex items-center gap-1 mt-0.5">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                    E2E Encrypted
                                </p>
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Footer info */}
            <div className="p-4 border-t border-accent/10">
                <div className="flex items-center gap-2 text-dark-400 text-xs">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    {users.length} user{users.length !== 1 ? 's' : ''} online
                </div>
            </div>
        </div>
    );
}
