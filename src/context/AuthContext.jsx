import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(false);

    useEffect(() => {
        // Timeout: if session check takes > 8 seconds, stop loading
        const timeout = setTimeout(() => {
            setLoading(false);
            setConnectionError(true);
        }, 8000);

        // Get initial session
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                clearTimeout(timeout);
                setUser(session?.user ?? null);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Session fetch error:', err);
                clearTimeout(timeout);
                setLoading(false);
                setConnectionError(true);
            });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
                setLoading(false);
                setConnectionError(false);
            }
        );

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    async function signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    }

    async function signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    }

    async function signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }

    const value = {
        user,
        loading,
        connectionError,
        signUp,
        signIn,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
