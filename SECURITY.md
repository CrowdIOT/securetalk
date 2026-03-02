# SecureTalk — Security Documentation

## Overview

SecureTalk implements **true End-to-End Encryption (E2EE)**. Messages are encrypted and decrypted exclusively in the user's browser. The server (Supabase) only stores ciphertext and can **never** access plaintext messages.

---

## Cryptographic Primitives

### 1. Elliptic-Curve Diffie-Hellman (ECDH) — Key Exchange

**What is it?**
ECDH is the elliptic-curve variant of the Diffie-Hellman key exchange protocol. It allows two parties to independently compute a shared secret over an insecure channel without ever transmitting the secret itself.

**How SecureTalk uses it:**
- Each user generates an **ECDH key pair** on the P-256 curve using the Web Crypto API.
- The **public key** is stored in the Supabase database (as a JWK).
- The **private key** never leaves the browser — it's stored in `localStorage`.
- When User A wants to chat with User B:
  1. User A fetches User B's public key from the database.
  2. User A computes the shared secret: `ECDH(A_private, B_public) → shared_bits`
  3. User B independently computes the same shared secret: `ECDH(B_private, A_public) → shared_bits`
  4. Both arrive at the **identical shared secret** without it ever being transmitted.

### 2. HKDF — Key Derivation

**What is it?**
HMAC-based Key Derivation Function (HKDF) derives a cryptographically strong key from raw key material. It uses SHA-256, a salt, and context info to produce a uniform-length key.

**How SecureTalk uses it:**
- The raw ECDH shared bits (256 bits) are fed through HKDF.
- Output: a **256-bit AES key** suitable for AES-GCM encryption.
- Parameters:
  - Hash: SHA-256
  - Salt: `"SecureTalk-Salt-v1"`
  - Info: `"SecureTalk-AES-Key"`

### 3. AES-256-GCM — Message Encryption

**What is it?**
Advanced Encryption Standard (AES) with Galois/Counter Mode (GCM) provides both **confidentiality** (encryption) and **integrity** (authentication). AES-256-GCM uses a 256-bit key and a 96-bit initialization vector (IV).

**How SecureTalk uses it:**
- **Encryption (sending):**
  1. Generate a random 12-byte IV.
  2. Encrypt the plaintext using AES-256-GCM with the derived AES key and IV.
  3. Store the base64-encoded ciphertext + IV in the database.
- **Decryption (receiving):**
  1. Fetch the ciphertext and IV from the database.
  2. Derive the same AES key using ECDH + HKDF.
  3. Decrypt the ciphertext locally in the browser.
- **Integrity:** GCM mode includes a 128-bit authentication tag. Any tampering with the ciphertext is detected and decryption fails.

---

## Security Properties

### Why the Server Cannot Read Messages

1. The server only stores: ciphertext (encrypted bytes) + IV (random bytes).
2. Decryption requires the AES key, which is derived from the ECDH shared secret.
3. The ECDH shared secret requires a private key.
4. Private keys **never leave the browser** — they are stored in `localStorage` only.
5. Even if the database is fully compromised, the attacker cannot decrypt messages without both users' private keys.

### Perfect Forward Secrecy

If key regeneration is enabled (clearing localStorage and generating new keys), previously intercepted ciphertexts remain secure because the old shared secret cannot be re-derived with new keys. This achieves **forward secrecy** at the key rotation level.

To achieve per-message forward secrecy (as in Signal Protocol), a ratcheting mechanism would be needed — this is a future enhancement.

### MITM (Man-in-the-Middle) Attack Prevention

ECDH alone does not prevent MITM attacks — an attacker could replace public keys in transit. SecureTalk mitigates this through:

1. **HTTPS/TLS:** All communication with Supabase uses HTTPS, preventing tampering during transit.
2. **Authenticated API:** Supabase RLS policies ensure only the key owner can insert/update their public key.
3. **Key Verification (recommended):** For maximum security, users should compare public key fingerprints out-of-band (e.g., in person or via a verified channel).

### Why HTTPS Is Still Required

E2EE protects **message content**, but HTTPS protects:
- Session tokens and auth cookies
- Public key exchange (prevents MITM substitution)
- API requests and metadata
- User enumeration and presence information

**E2EE + HTTPS together** provide defense in depth.

---

## Data Flow

```
User A                          Supabase                        User B
  │                               │                               │
  ├── Generate ECDH key pair ──►  │                               │
  ├── Store public key ─────────► │ ◄──── Store public key ───────┤
  │                               │                               ├── Generate ECDH key pair
  │                               │                               │
  ├── Fetch B's public key ◄───── │                               │
  ├── ECDH derive shared secret   │                               │
  ├── HKDF derive AES key         │                               │
  ├── AES-GCM encrypt message     │                               │
  ├── Store {ciphertext, iv} ──►  │ ── Realtime push ───────────► │
  │                               │                               ├── Fetch A's public key
  │                               │                               ├── ECDH derive shared secret
  │                               │                               ├── HKDF derive AES key
  │                               │                               ├── AES-GCM decrypt message
  │                               │                               ├── Display plaintext
```

---

## Threat Model Summary

| Threat                        | Mitigation                                      |
|-------------------------------|------------------------------------------------|
| Server reads messages         | E2EE — server only has ciphertext              |
| Database breach              | Messages are encrypted, keys never stored on server |
| MITM on key exchange          | HTTPS + RLS policies + out-of-band verification |
| Message tampering             | AES-GCM authentication tag detects modification |
| Replay attacks               | Unique IV per message                           |
| Session hijacking             | Supabase auth + HTTPS                          |
| Private key theft (device)    | Device security responsibility of user          |
