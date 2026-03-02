// ═══════════════════════════════════════════════════════════
// SecureTalk — Client-Side Cryptography Module
// ECDH (P-256) + HKDF + AES-256-GCM
// ALL crypto operations happen ONLY in the browser.
// ═══════════════════════════════════════════════════════════

const ECDH_PARAMS = { name: 'ECDH', namedCurve: 'P-256' };
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const HKDF_HASH = 'SHA-256';
const HKDF_INFO = new TextEncoder().encode('SecureTalk-AES-Key');
const HKDF_SALT = new TextEncoder().encode('SecureTalk-Salt-v1');

// ── Key Pair Generation ──

/**
 * Generate an ECDH key pair using the Web Crypto API.
 * Private key is extractable so it can be stored locally.
 * @returns {Promise<CryptoKeyPair>} { publicKey, privateKey }
 */
export async function generateKeyPair() {
    return await crypto.subtle.generateKey(
        ECDH_PARAMS,
        true, // extractable (needed to export/import)
        ['deriveBits']
    );
}

// ── Key Export/Import ──

/**
 * Export a public key as a JWK string for database storage.
 * @param {CryptoKey} publicKey
 * @returns {Promise<string>} JSON string of JWK
 */
export async function exportPublicKey(publicKey) {
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    return JSON.stringify(jwk);
}

/**
 * Import a public key from a JWK string.
 * @param {string} jwkString - JSON string of JWK
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(jwkString) {
    const jwk = JSON.parse(jwkString);
    return await crypto.subtle.importKey(
        'jwk',
        jwk,
        ECDH_PARAMS,
        true,
        []
    );
}

/**
 * Export a private key as a JWK string for local storage.
 * @param {CryptoKey} privateKey
 * @returns {Promise<string>} JSON string of JWK
 */
export async function exportPrivateKey(privateKey) {
    const jwk = await crypto.subtle.exportKey('jwk', privateKey);
    return JSON.stringify(jwk);
}

/**
 * Import a private key from a JWK string.
 * @param {string} jwkString - JSON string of JWK
 * @returns {Promise<CryptoKey>}
 */
export async function importPrivateKey(jwkString) {
    const jwk = JSON.parse(jwkString);
    return await crypto.subtle.importKey(
        'jwk',
        jwk,
        ECDH_PARAMS,
        true,
        ['deriveBits']
    );
}

// ── Shared Secret Derivation ──

/**
 * Derive a shared secret using ECDH, then derive an AES-256-GCM key via HKDF.
 * @param {CryptoKey} privateKey - Our private key
 * @param {CryptoKey} publicKey  - Recipient's public key
 * @returns {Promise<CryptoKey>} AES-GCM key
 */
export async function deriveSharedKey(privateKey, publicKey) {
    // Step 1: ECDH → raw shared bits
    const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: publicKey },
        privateKey,
        256
    );

    // Step 2: Import shared bits as HKDF key material
    const hkdfKey = await crypto.subtle.importKey(
        'raw',
        sharedBits,
        'HKDF',
        false,
        ['deriveKey']
    );

    // Step 3: HKDF → AES-256-GCM key
    return await crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: HKDF_HASH,
            salt: HKDF_SALT,
            info: HKDF_INFO,
        },
        hkdfKey,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

// ── Message Encryption ──

/**
 * Encrypt a plaintext message using AES-256-GCM.
 * @param {CryptoKey} aesKey - Derived AES key
 * @param {string} plaintext - Message to encrypt
 * @returns {Promise<{ ciphertext: string, iv: string }>} Base64-encoded ciphertext and IV
 */
export async function encryptMessage(aesKey, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encoded
    );

    return {
        ciphertext: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv),
    };
}

// ── Message Decryption ──

/**
 * Decrypt a ciphertext message using AES-256-GCM.
 * @param {CryptoKey} aesKey - Derived AES key
 * @param {string} ciphertextB64 - Base64-encoded ciphertext
 * @param {string} ivB64 - Base64-encoded IV
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(aesKey, ciphertextB64, ivB64) {
    const ciphertext = base64ToArrayBuffer(ciphertextB64);
    const iv = base64ToArrayBuffer(ivB64);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ciphertext
    );

    return new TextDecoder().decode(decrypted);
}

// ── Local Key Storage ──

const PRIVATE_KEY_PREFIX = 'securetalk_private_key_';

/**
 * Save a private key to localStorage (keyed by userId).
 * In production, consider using IndexedDB with additional protection.
 * @param {string} userId
 * @param {CryptoKey} privateKey
 */
export async function savePrivateKey(userId, privateKey) {
    const jwkString = await exportPrivateKey(privateKey);
    localStorage.setItem(PRIVATE_KEY_PREFIX + userId, jwkString);
}

/**
 * Load a private key from localStorage.
 * @param {string} userId
 * @returns {Promise<CryptoKey|null>}
 */
export async function loadPrivateKey(userId) {
    const jwkString = localStorage.getItem(PRIVATE_KEY_PREFIX + userId);
    if (!jwkString) return null;
    return await importPrivateKey(jwkString);
}

/**
 * Check if a private key exists in localStorage.
 * @param {string} userId
 * @returns {boolean}
 */
export function hasPrivateKey(userId) {
    return localStorage.getItem(PRIVATE_KEY_PREFIX + userId) !== null;
}

// ── Utility Functions ──

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
