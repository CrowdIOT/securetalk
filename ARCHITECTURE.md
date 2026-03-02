# SecureTalk — Architecture Documentation

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────────────┐ │
│  │  React   │  │  Supabase│  │      Web Crypto API            │ │
│  │  UI      │◄─┤  JS SDK  │  │  ┌──────┐ ┌────┐ ┌─────────┐  │ │
│  │          │  │          │  │  │ ECDH │ │HKDF│ │ AES-GCM │  │ │
│  └──────────┘  └────┬─────┘  │  └──────┘ └────┘ └─────────┘  │ │
│                     │        └────────────────────────────────┘ │
│                     │        ┌────────────────────────────────┐ │
│                     │        │      Local Storage             │ │
│                     │        │  (Private Key — JWK)           │ │
│                     │        └────────────────────────────────┘ │
└─────────────────────┼──────────────────────────────────────────┘
                      │ HTTPS (encrypted transport)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Backend)                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  PostgreSQL  │  │     Auth     │  │      Realtime         │ │
│  │              │  │              │  │                       │ │
│  │ • profiles   │  │ • Email/Pass │  │ • postgres_changes    │ │
│  │ • pub_keys   │  │ • Sessions   │  │ • INSERT on messages  │ │
│  │ • messages   │  │ • JWT tokens │  │ • Channel subscriptions│ │
│  │   (RLS ✓)    │  │              │  │                       │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Map

### Frontend (`src/`)

| File | Purpose |
|------|---------|
| `main.jsx` | React entry point |
| `App.jsx` | Auth-gated routing (AuthPage ↔ ChatPage) |
| `index.css` | Tailwind + custom dark theme + glassmorphism |
| `lib/supabaseClient.js` | Supabase SDK initialization |
| `lib/crypto.js` | All cryptographic operations (ECDH, HKDF, AES-GCM) |
| `context/AuthContext.jsx` | Auth state management (session, signUp, signIn, signOut) |
| `hooks/useKeyManager.js` | Key pair lifecycle (generate, store, load) |
| `pages/AuthPage.jsx` | Login / Register UI |
| `pages/ChatPage.jsx` | Chat layout (sidebar + chat window) |
| `components/UserList.jsx` | User sidebar with search |
| `components/ChatWindow.jsx` | Message display, realtime subscription, encryption |
| `components/MessageInput.jsx` | Message composition + send |
| `components/MessageBubble.jsx` | Individual message rendering |

### Backend (Supabase)

| Resource | Purpose |
|----------|---------|
| `auth.users` | Supabase-managed user authentication |
| `public.profiles` | User emails (auto-created via trigger) |
| `public.user_public_keys` | ECDH public keys (JWK format) |
| `public.messages` | Encrypted messages (ciphertext + IV only) |
| RLS Policies | Row-level security on all tables |
| Realtime | Push new messages to subscribers |

## Data Flow

1. **Registration:** User signs up → Supabase creates `auth.users` row → Trigger creates `profiles` row → Client generates ECDH key pair → Public key stored in `user_public_keys` → Private key stored in `localStorage`.

2. **Sending a Message:** Client fetches recipient's public key → ECDH derives shared bits → HKDF derives AES key → AES-GCM encrypts plaintext → `{ciphertext, iv}` stored in `messages` table.

3. **Receiving a Message:** Supabase Realtime pushes `INSERT` event → Client fetches sender's public key (cached) → ECDH + HKDF derives same AES key → AES-GCM decrypts ciphertext → Plaintext displayed in UI.

## Security Boundary

```
╔══════════════════════════════════════════════╗
║           TRUST BOUNDARY (Browser)           ║
║                                              ║
║  Plaintext  ──► Encrypt ──► Ciphertext  ──►  ║──► Server
║  Plaintext  ◄── Decrypt ◄── Ciphertext  ◄──  ║◄── Server
║                                              ║
║  Private Key stays HERE                      ║
╚══════════════════════════════════════════════╝
```

The server **never** has access to plaintext or private keys.

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | `https://your-app.vercel.app` |
| Backend | Supabase | `https://your-project.supabase.co` |
| Auth | Supabase Auth | Built-in |
| Database | Supabase PostgreSQL | Built-in |
| Realtime | Supabase Realtime | Built-in |

### Deployment Steps

1. Push code to GitHub.
2. Connect repo to Vercel.
3. Set environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Vercel.
4. Deploy. HTTPS is automatic on Vercel.
