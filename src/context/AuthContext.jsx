import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(false);
    const retryCount = useRef(0);
    const maxRetries = 10;

    useEffect(() => {
        let cancelled = false;

        async function tryGetSession() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (cancelled) return;

                if (error) throw error;

                setUser(session?.user ?? null);
                setLoading(false);
                setConnectionError(false);
            } catch (err) {
                console.error(`Session fetch attempt ${retryCount.current + 1} failed:`, err);
                retryCount.current += 1;

                if (cancelled) return;

                if (retryCount.current < maxRetries) {
                    // Retry after 3 seconds
                    setTimeout(() => {
                        if (!cancelled) tryGetSession();
                    }, 3000);
                } else {
                    setLoading(false);
                    setConnectionError(true);
                }
            }
        }

        tryGetSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
                setLoading(false);
                setConnectionError(false);
            }
        );

        return () => {
            cancelled = true;
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
