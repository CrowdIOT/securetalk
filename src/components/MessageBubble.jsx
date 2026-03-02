export default function MessageBubble({ message, isOwn, showEncrypted }) {
    const time = new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 animate-slide-up`}>
            <div
                className={`
          max-w-[75%] sm:max-w-[65%] rounded-2xl px-4 py-2.5
          ${isOwn
                        ? 'bg-gradient-to-br from-accent to-indigo-600 text-white rounded-br-md'
                        : 'glass-light text-dark-100 rounded-bl-md'
                    }
        `}
            >
                {showEncrypted ? (
                    <div className="space-y-1">
                        <p className="text-xs font-mono opacity-70 break-all leading-relaxed">
                            {message.encrypted_message}
                        </p>
                        <p className="text-[10px] opacity-50">IV: {message.iv}</p>
                    </div>
                ) : (
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {message.decryptedText !== undefined
                            ? message.decryptedText
                            : (
                                <span className="italic opacity-50">Decrypting...</span>
                            )}
                    </p>
                )}
                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-dark-400'}`}>
                        {time}
                    </span>
                    {isOwn && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
}
