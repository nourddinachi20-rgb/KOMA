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
  deletedLibraryKeys?: Record<string, number>;
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

function stripSyncedChapters<T extends { manga: { chapters?: unknown } }>(entry: T): T {
  if (!entry.manga || entry.manga.chapters == null) return entry;
  return {
    ...entry,
    manga: {
      ...entry.manga,
      chapters: null,
    },
  };
}

/**
 * Strips heavy cached `manga.chapters` lists before encrypting so the sync vault
 * stays ~10-20x smaller and safely within Cloudflare Worker RAM and KV 25 MiB limits.
 */
export function compactSyncPayload(payload: SyncVaultPayload): SyncVaultPayload {
  return {
    ...payload,
    library: (payload.library ?? []).map(stripSyncedChapters),
    history: (payload.history ?? []).map(stripSyncedChapters),
  };
}

async function postSyncJson<T>(
  baseUrl: string,
  endpoint: string,
  payload: Record<string, unknown>,
  fallbackError: string,
): Promise<T> {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `${fallbackError} (${res.status})`);
  }
  return data;
}

export async function remoteCreateAccount(
  serverUrl: string,
  username: string,
  password: string,
  initialPayload: SyncVaultPayload,
): Promise<SyncCredentials> {
  const base = cleanServerUrl(serverUrl);
  const creds = await deriveSyncCredentials(username, password);
  const vault = await encryptVaultData(
    creds,
    compactSyncPayload(initialPayload),
    initialPayload.syncedAt,
  );

  await postSyncJson(
    base,
    '/api/register',
    { username: creds.username, authHash: creds.authHash, vault },
    'Failed to create account',
  );
  return creds;
}

export async function remoteSignInAndPull(
  serverUrl: string,
  username: string,
  password: string,
): Promise<{ creds: SyncCredentials; payload: SyncVaultPayload | null; updatedAt: number }> {
  const base = cleanServerUrl(serverUrl);
  const creds = await deriveSyncCredentials(username, password);

  const data = await postSyncJson<{ vault?: EncryptedVaultBlob | null; updatedAt?: number }>(
    base,
    '/api/login',
    { username: creds.username, authHash: creds.authHash },
    'Sign in failed',
  );
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
  const data = await postSyncJson<{ vault?: EncryptedVaultBlob | null; updatedAt?: number }>(
    base,
    '/api/login',
    { username: creds.username, authHash: creds.authHash },
    'Sync pull failed',
  );
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
  const vault = await encryptVaultData(creds, compactSyncPayload(payload), payload.syncedAt);

  const data = await postSyncJson<{ updatedAt?: number }>(
    base,
    '/api/sync',
    { username: creds.username, authHash: creds.authHash, vault },
    'Sync upload failed',
  );
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
