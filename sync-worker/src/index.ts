export interface Env {
  KOMA_VAULT: KVNamespace;
}

interface StoredAccount {
  verifierHash: string;
  createdAt: number;
  updatedAt: number;
  vault: unknown;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function validUsername(u: unknown): u is string {
  return typeof u === 'string' && /^[a-z0-9_.-]{3,32}$/.test(u);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const body = (await request.json().catch(() => null)) as {
      username?: string;
      authHash?: string;
      vault?: unknown;
    } | null;

    if (!body || !validUsername(body.username) || typeof body.authHash !== 'string' || body.authHash.length < 16) {
      return json({ error: 'Invalid username (3-32 lowercase chars) or credentials.' }, 400);
    }

    const key = `user:${body.username}`;
    const verifier = await sha256Hex(`${body.username}:${body.authHash}`);

    if (url.pathname === '/api/register') {
      const existing = await env.KOMA_VAULT.get(key);
      if (existing) {
        return json({ error: 'Username already taken.' }, 409);
      }
      const now = Date.now();
      const record: StoredAccount = {
        verifierHash: verifier,
        createdAt: now,
        updatedAt: now,
        vault: body.vault ?? null,
      };
      await env.KOMA_VAULT.put(key, JSON.stringify(record));
      return json({ ok: true, updatedAt: now });
    }

    const raw = await env.KOMA_VAULT.get(key);
    if (!raw) {
      return json({ error: 'Account not found.' }, 404);
    }
    const account = JSON.parse(raw) as StoredAccount;
    if (account.verifierHash !== verifier) {
      return json({ error: 'Incorrect username or password.' }, 401);
    }

    if (url.pathname === '/api/login') {
      return json({ ok: true, vault: account.vault, updatedAt: account.updatedAt });
    }

    if (url.pathname === '/api/sync') {
      if (!body.vault) {
        return json({ error: 'Missing encrypted vault payload.' }, 400);
      }
      const now = Date.now();
      account.vault = body.vault;
      account.updatedAt = now;
      await env.KOMA_VAULT.put(key, JSON.stringify(account));
      return json({ ok: true, updatedAt: now });
    }

    return json({ error: 'Not found' }, 404);
  },
};
