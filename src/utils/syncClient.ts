import type { Category, HistoryEntry, LibraryEntry, ReadingStats } from '../types';
import {
  decryptVaultData,
  deriveSyncCredentials,
  encryptVaultData,
  type EncryptedVaultBlob,
  type SyncCredentials,
} from './syncCrypto';

export const DEFAULT_SYNC_SERVER_URL = 'https://koma-zero-knowledge-sync.koma-virtualdrum.workers.dev';

export interface SyncVaultPayload {
  categories: Category[];
  library: LibraryEntry[];
  history: HistoryEntry[];
  stats?: ReadingStats;
  syncedAt: number;
}

export function resolveSyncServerUrl(url?: string): string {
  const trimmed = (url ?? '').trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_SYNC_SERVER_URL;
}

function cleanServerUrl(url?: string): string {
  const resolved = resolveSyncServerUrl(url);
  if (!resolved) {
    throw new Error('Sync server is not configured. Open "Custom sync server" or wait for the default server.');
  }
  return resolved;
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

export async function remotePullVault(
  serverUrl: string | undefined,
  creds: SyncCredentials,
): Promise<{ payload: SyncVaultPayload | null; updatedAt: number }> {
  const base = cleanServerUrl(serverUrl);
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
    throw new Error(data.error || `Sync pull failed (${res.status})`);
  }
  const payload = data.vault
    ? await decryptVaultData<SyncVaultPayload>(creds, data.vault)
    : null;
  return { payload, updatedAt: data.updatedAt ?? 0 };
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
