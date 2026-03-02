import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(false);
    const resolved = useRef(false);

    useEffect(() => {
        // Timeout: if session check takes > 15 seconds, show error
        const timeout = setTimeout(() => {
            if (!resolved.current) {
                resolved.current = true;
                setLoading(false);
                setConnectionError(true);
            }
        }, 15000);

        // Get initial session
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                if (!resolved.current) {
                    resolved.current = true;
                    clearTimeout(timeout);
                    setUser(session?.user ?? null);
                    setLoading(false);
                    // No session is NORMAL (user not logged in), NOT an error
                }
            })
            .catch((err) => {
                console.error('Session fetch error:', err);
                if (!resolved.current) {
                    resolved.current = true;
                    clearTimeout(timeout);
                    setLoading(false);
                    setConnectionError(true);
                }
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
