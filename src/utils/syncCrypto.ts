export interface SyncCredentials {
  username: string;
  authHash: string;
  encryptionKey: CryptoKey;
  keyJwk: JsonWebKey;
}

export interface EncryptedVaultBlob {
  v: 1;
  iv: string;
  ct: string;
  updatedAt: number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + step)));
  }
  return btoa(chunks.join(''));
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
}

/**
 * Derives TWO independent keys locally using PBKDF2-SHA-256:
 *  - AES-256-GCM encryption key (stored locally only as JWK; never sent to server)
 *  - Server authentication verifier hash (server never sees password or encryption key)
 */
export async function deriveSyncCredentials(
  rawUsername: string,
  password: string,
): Promise<SyncCredentials> {
  const username = rawUsername.trim().toLowerCase();
  if (!username || username.length < 3) {
    throw new Error('Username must be at least 3 characters.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  // Derive 512 bits: [0..32) for AES-256-GCM encryption, [32..64) for Auth verifier
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(`KOMA-ZERO-KNOWLEDGE-v1:${username}`),
      iterations: 150_000,
      hash: 'SHA-256',
    },
    baseKey,
    512,
  );

  const all = new Uint8Array(derivedBits);
  const encKeyBytes = all.slice(0, 32);
  const authSecretBytes = all.slice(32, 64);

  const authDigest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', toArrayBuffer(authSecretBytes)),
  );
  const authHash = toBase64(authDigest);

  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(encKeyBytes),
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt'],
  );
  const keyJwk = await crypto.subtle.exportKey('jwk', encryptionKey);

  return { username, authHash, encryptionKey, keyJwk };
}

export async function restoreSyncCredentials(
  username: string,
  authHash: string,
  keyJwk: JsonWebKey,
): Promise<SyncCredentials> {
  const encryptionKey = await crypto.subtle.importKey(
    'jwk',
    keyJwk,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt'],
  );
  return { username, authHash, encryptionKey, keyJwk };
}

export async function encryptVaultData(
  creds: SyncCredentials,
  payload: unknown,
  updatedAt = Date.now(),
): Promise<EncryptedVaultBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    creds.encryptionKey,
    toArrayBuffer(plaintext),
  );
  return {
    v: 1,
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(encrypted)),
    updatedAt,
  };
}

export async function decryptVaultData<T = unknown>(
  creds: SyncCredentials,
  blob: EncryptedVaultBlob,
): Promise<T> {
  const iv = fromBase64(blob.iv);
  const ct = fromBase64(blob.ct);
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      creds.encryptionKey,
      toArrayBuffer(ct),
    );
    return JSON.parse(dec.decode(new Uint8Array(plainBuf))) as T;
  } catch {
    throw new Error('Decryption failed — wrong password or corrupted data.');
  }
}
