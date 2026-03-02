import { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || sending || disabled) return;

        setSending(true);
        try {
            await onSend(trimmed);
            setText('');
        } catch (err) {
            console.error('Send error:', err);
        } finally {
            setSending(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="p-4 glass border-t border-accent/10">
            <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type an encrypted message..."
                        rows={1}
                        disabled={disabled}
                        className="input-field resize-none py-3 pr-4 min-h-[48px] max-h-[120px]"
                        style={{ height: 'auto' }}
                        onInput={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={!text.trim() || sending || disabled}
                    className="btn-primary p-3 rounded-xl shrink-0 flex items-center justify-center"
                    title="Send encrypted message"
                >
                    {sending ? (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    )}
                </button>
            </div>

            <div className="flex items-center gap-1.5 mt-2 text-dark-500 text-[10px]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Messages are end-to-end encrypted. Only you and the recipient can read them.
            </div>
        </form>
    );
}
