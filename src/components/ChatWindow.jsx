import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    importPublicKey,
    deriveSharedKey,
    encryptMessage,
    decryptMessage,
} from '../lib/crypto';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

export default function ChatWindow({ currentUser, selectedUser, privateKey, showEncrypted }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [aesKey, setAesKey] = useState(null);
    const [keyError, setKeyError] = useState('');
    const messagesEndRef = useRef(null);
    const channelRef = useRef(null);
    const aesKeyRef = useRef(null);
    const pollingRef = useRef(null);
    const lastMessageTimeRef = useRef(null);

    // Keep aesKeyRef in sync
    useEffect(() => {
        aesKeyRef.current = aesKey;
    }, [aesKey]);

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    }, []);

    // Helper: decrypt a single message
    const decryptMsg = useCallback(async (msg, key) => {
        try {
            const decryptedText = await decryptMessage(key, msg.encrypted_message, msg.iv);
            return { ...msg, decryptedText };
        } catch {
            return { ...msg, decryptedText: '[Decryption failed]' };
        }
    }, []);

    // Derive the shared AES key with the selected user
    useEffect(() => {
        if (!selectedUser || !privateKey) return;

        let cancelled = false;

        async function deriveKey() {
            setAesKey(null);
            setKeyError('');
            setMessages([]);
            setLoading(true);

            try {
                const { data, error } = await supabase
                    .from('user_public_keys')
                    .select('public_key')
                    .eq('user_id', selectedUser.id)
                    .maybeSingle();

                if (error) throw error;
                if (!data) {
                    setKeyError('Recipient has no encryption key yet.');
                    setLoading(false);
                    return;
                }

                const recipientPublicKey = await importPublicKey(data.public_key);
                const sharedKey = await deriveSharedKey(privateKey, recipientPublicKey);

                if (!cancelled) {
                    setAesKey(sharedKey);
                }
            } catch (err) {
                console.error('Key derivation error:', err);
                if (!cancelled) {
                    setKeyError('Failed to establish encrypted channel.');
                    setLoading(false);
                }
            }
        }

        deriveKey();
        return () => { cancelled = true; };
    }, [selectedUser, privateKey]);

    // Fetch all messages for this conversation
    const fetchAllMessages = useCallback(async (key) => {
        const activeKey = key || aesKeyRef.current;
        if (!activeKey || !selectedUser) return;

        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(
                    `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`
                )
                .order('created_at', { ascending: true });

            if (error) throw error;

            const decrypted = await Promise.all(
                (data || []).map((msg) => decryptMsg(msg, activeKey))
            );

            setMessages(decrypted);
            if (decrypted.length > 0) {
                lastMessageTimeRef.current = decrypted[decrypted.length - 1].created_at;
            }
            scrollToBottom();
            return decrypted;
        } catch (err) {
            console.error('Fetch messages error:', err);
        }
    }, [selectedUser, currentUser?.id, decryptMsg, scrollToBottom]);

    // Fetch messages when aesKey is ready
    useEffect(() => {
        if (!aesKey || !selectedUser) return;

        let cancelled = false;

        async function init() {
            setLoading(true);
            await fetchAllMessages(aesKey);
            if (!cancelled) setLoading(false);
        }

        init();
        return () => { cancelled = true; };
    }, [aesKey, selectedUser, fetchAllMessages]);

    // Polling for new messages (fallback if Realtime doesn't work)
    useEffect(() => {
        if (!aesKey || !selectedUser) return;

        // Poll every 3 seconds for new messages
        pollingRef.current = setInterval(async () => {
            const activeKey = aesKeyRef.current;
            if (!activeKey) return;

            try {
                let query = supabase
                    .from('messages')
                    .select('*')
                    .or(
                        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`
                    )
                    .order('created_at', { ascending: true });

                // Only fetch newer messages if we have a last timestamp
                if (lastMessageTimeRef.current) {
                    query = query.gt('created_at', lastMessageTimeRef.current);
                }

                const { data, error } = await query;
                if (error || !data || data.length === 0) return;

                const newDecrypted = await Promise.all(
                    data.map((msg) => decryptMsg(msg, activeKey))
                );

                setMessages((prev) => {
                    const existingIds = new Set(prev.map((m) => m.id));
                    const genuinelyNew = newDecrypted.filter((m) => !existingIds.has(m.id));
                    if (genuinelyNew.length === 0) return prev;

                    // Update the last message time
                    const last = genuinelyNew[genuinelyNew.length - 1];
                    lastMessageTimeRef.current = last.created_at;

                    return [...prev, ...genuinelyNew];
                });

                scrollToBottom();
            } catch (err) {
                // Silently ignore polling errors
            }
        }, 3000);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [aesKey, selectedUser?.id, currentUser?.id, decryptMsg, scrollToBottom]);

    // Also try Realtime (will work instantly if Supabase Realtime is working)
    useEffect(() => {
        if (!selectedUser || !currentUser) return;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channelName = `chat-${[currentUser.id, selectedUser.id].sort().join('-')}-${Date.now()}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                async (payload) => {
                    const msg = payload.new;

                    const isRelevant =
                        (msg.sender_id === currentUser.id && msg.receiver_id === selectedUser.id) ||
                        (msg.sender_id === selectedUser.id && msg.receiver_id === currentUser.id);

                    if (!isRelevant) return;

                    const currentAesKey = aesKeyRef.current;
                    if (!currentAesKey) return;

                    try {
                        const decrypted = await decryptMsg(msg, currentAesKey);
                        setMessages((prev) => {
                            if (prev.find((m) => m.id === msg.id)) return prev;
                            lastMessageTimeRef.current = msg.created_at;
                            return [...prev, decrypted];
                        });
                        scrollToBottom();
                    } catch (err) {
                        console.error('Realtime decrypt error:', err);
                    }
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Channel status:', status);
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [selectedUser?.id, currentUser?.id, decryptMsg, scrollToBottom]);

    // Send an encrypted message — shows instantly (optimistic update)
    async function handleSend(plaintext) {
        if (!aesKey) return;

        const { ciphertext, iv } = await encryptMessage(aesKey, plaintext);

        // Insert into database
        const { data, error } = await supabase
            .from('messages')
            .insert({
                sender_id: currentUser.id,
                receiver_id: selectedUser.id,
                encrypted_message: ciphertext,
                iv: iv,
            })
            .select()
            .single();

        if (error) throw error;

        // Immediately add to local messages (optimistic update)
        if (data) {
            setMessages((prev) => {
                if (prev.find((m) => m.id === data.id)) return prev;
                lastMessageTimeRef.current = data.created_at;
                return [...prev, { ...data, decryptedText: plaintext }];
            });
            scrollToBottom();
        }
    }

    // Key error state
    if (keyError) {
        return (
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-warning/10 mb-3">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <p className="text-dark-200 text-sm">{keyError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Chat header */}
            <div className="glass border-b border-accent/10 px-5 py-3 flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent-light font-semibold text-sm">
                    {selectedUser.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-100 truncate">{selectedUser.email}</p>
                    <div className="flex items-center gap-1 text-[11px] text-success">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Encrypted channel active
                    </div>
                </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <svg className="animate-spin h-8 w-8 text-accent mx-auto mb-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <p className="text-dark-400 text-sm">Decrypting messages...</p>
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/5 mb-3">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-dark-400">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </div>
                            <p className="text-dark-300 text-sm font-medium">No messages yet</p>
                            <p className="text-dark-500 text-xs mt-1">Send the first encrypted message!</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isOwn={msg.sender_id === currentUser.id}
                            showEncrypted={showEncrypted}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <MessageInput onSend={handleSend} disabled={!aesKey} />
        </div>
    );
}
