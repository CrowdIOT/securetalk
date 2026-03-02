import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    generateKeyPair,
    exportPublicKey,
    savePrivateKey,
    loadPrivateKey,
    hasPrivateKey,
} from '../lib/crypto';

/**
 * Hook to manage ECDH key pair lifecycle.
 * - On login: checks if user already has a public key in DB.
 * - If not: generates new pair, stores public in DB, private in localStorage.
 * - If yes: loads private key from localStorage.
 * - Exposes: privateKey, keysReady, error
 */
export function useKeyManager(user) {
    const [privateKey, setPrivateKey] = useState(null);
    const [keysReady, setKeysReady] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user) {
            setPrivateKey(null);
            setKeysReady(false);
            return;
        }

        async function initializeKeys() {
            try {
                // Check if user already has a public key in the DB
                const { data: existingKey, error: fetchError } = await supabase
                    .from('user_public_keys')
                    .select('public_key')
                    .eq('user_id', user.id)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    // PGRST116 = no rows returned (expected for new users)
                    throw fetchError;
                }

                if (existingKey && hasPrivateKey(user.id)) {
                    // Keys already exist — load private key from local storage
                    const pk = await loadPrivateKey(user.id);
                    if (pk) {
                        setPrivateKey(pk);
                        setKeysReady(true);
                        return;
                    }
                }

                // Generate new key pair
                const keyPair = await generateKeyPair();
                const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

                // Store public key in Supabase (upsert for idempotency)
                const { error: upsertError } = await supabase
                    .from('user_public_keys')
                    .upsert(
                        { user_id: user.id, public_key: publicKeyJwk },
                        { onConflict: 'user_id' }
                    );

                if (upsertError) throw upsertError;

                // Store private key locally
                await savePrivateKey(user.id, keyPair.privateKey);

                setPrivateKey(keyPair.privateKey);
                setKeysReady(true);
            } catch (err) {
                console.error('Key initialization error:', err);
                setError(err.message || 'Failed to initialize encryption keys');
            }
        }

        initializeKeys();
    }, [user]);

    return { privateKey, keysReady, error };
}
