import type { Category, HistoryEntry, LibraryEntry, ReadingStats } from '../types';
import {
  decryptVaultData,
  deriveSyncCredentials,
  encryptVaultData,
  type EncryptedVaultBlob,
  type SyncCredentials,
} from './syncCrypto';

export interface SyncVaultPayload {
  categories: Category[];
  library: LibraryEntry[];
  history: HistoryEntry[];
  stats?: ReadingStats;
  syncedAt: number;
}

function cleanServerUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Enter your Sync Server URL first (see sync-worker/README.md to host free in 1 minute).');
  }
  return trimmed;
}

export async function remoteCreateAccount(
  serverUrl: string,
  username: string,
  password: string,
  initialPayload: SyncVaultPayload,
): Promise<SyncCredentials> {
  const base = cleanServerUrl(serverUrl);
  const creds = await deriveSyncCredentials(username, password);
  const vault = await encryptVaultData(creds, initialPayload, initialPayload.syncedAt);

  const res = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: creds.username,
      authHash: creds.authHash,
      vault,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Failed to create account (${res.status})`);
  }
  return creds;
}

export async function remoteSignInAndPull(
  serverUrl: string,
  username: string,
  password: string,
): Promise<{ creds: SyncCredentials; payload: SyncVaultPayload | null; updatedAt: number }> {
  const base = cleanServerUrl(serverUrl);
  const creds = await deriveSyncCredentials(username, password);

  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: creds.username,
      authHash: creds.authHash,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    vault?: EncryptedVaultBlob | null;
    updatedAt?: number;
  };
  if (!res.ok) {
    throw new Error(data.error || `Sign in failed (${res.status})`);
  }
  const payload = data.vault
    ? await decryptVaultData<SyncVaultPayload>(creds, data.vault)
    : null;
  return { creds, payload, updatedAt: data.updatedAt ?? 0 };
}

export async function remotePushVault(
  serverUrl: string,
  creds: SyncCredentials,
  payload: SyncVaultPayload,
): Promise<number> {
  const base = cleanServerUrl(serverUrl);
  const vault = await encryptVaultData(creds, payload, payload.syncedAt);

  const res = await fetch(`${base}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: creds.username,
      authHash: creds.authHash,
      vault,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; updatedAt?: number };
  if (!res.ok) {
    throw new Error(data.error || `Sync upload failed (${res.status})`);
  }
  return data.updatedAt ?? vault.updatedAt;
}

export async function exportEncryptedVaultFile(
  username: string,
  password: string,
  payload: SyncVaultPayload,
): Promise<string> {
  const creds = await deriveSyncCredentials(username, password);
  const blob = await encryptVaultData(creds, payload, payload.syncedAt);
  return JSON.stringify({ komaEncryptedVault: true, username: creds.username, blob });
}

export async function importEncryptedVaultFile(
  rawText: string,
  username: string,
  password: string,
): Promise<SyncVaultPayload> {
  const parsed = JSON.parse(rawText) as { blob?: EncryptedVaultBlob };
  if (!parsed.blob?.ct || !parsed.blob?.iv) {
    throw new Error('Invalid encrypted .koma vault file.');
  }
  const creds = await deriveSyncCredentials(username, password);
  return decryptVaultData<SyncVaultPayload>(creds, parsed.blob);
}
