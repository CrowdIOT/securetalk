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
 * - If yes but no local private key: regenerates pair and updates DB.
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
                console.log('[KeyManager] Initializing keys for user:', user.id);

                // Check if user already has a public key in the DB
                const { data: existingKey, error: fetchError } = await supabase
                    .from('user_public_keys')
                    .select('public_key')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (fetchError) {
                    console.error('[KeyManager] Fetch error:', fetchError);
                    throw fetchError;
                }

                // If keys exist in DB AND we have the private key locally, just load it
                if (existingKey && hasPrivateKey(user.id)) {
                    console.log('[KeyManager] Loading existing private key from localStorage');
                    const pk = await loadPrivateKey(user.id);
                    if (pk) {
                        setPrivateKey(pk);
                        setKeysReady(true);
                        console.log('[KeyManager] Keys loaded successfully');
                        return;
                    }
                }

                // Generate new key pair (first time, or private key lost)
                console.log('[KeyManager] Generating new ECDH key pair...');
                const keyPair = await generateKeyPair();
                const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

                if (existingKey) {
                    // Update existing public key
                    console.log('[KeyManager] Updating existing public key in DB...');
                    const { error: updateError } = await supabase
                        .from('user_public_keys')
                        .update({ public_key: publicKeyJwk })
                        .eq('user_id', user.id);

                    if (updateError) {
                        console.error('[KeyManager] Update error:', updateError);
                        throw updateError;
                    }
                } else {
                    // Insert new public key
                    console.log('[KeyManager] Inserting new public key in DB...');
                    const { error: insertError } = await supabase
                        .from('user_public_keys')
                        .insert({ user_id: user.id, public_key: publicKeyJwk });

                    if (insertError) {
                        console.error('[KeyManager] Insert error:', insertError);
                        throw insertError;
                    }
                }

                // Store private key locally
                await savePrivateKey(user.id, keyPair.privateKey);

                setPrivateKey(keyPair.privateKey);
                setKeysReady(true);
                console.log('[KeyManager] Keys initialized successfully');
            } catch (err) {
                console.error('[KeyManager] Key initialization error:', err);
                setError(err.message || 'Failed to initialize encryption keys');
            }
        }

        initializeKeys();
    }, [user]);

    return { privateKey, keysReady, error };
}
