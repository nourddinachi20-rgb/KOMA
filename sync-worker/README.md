# KOMA Zero-Knowledge Sync Worker

Tiny open-source Cloudflare Worker that stores **only end-to-end encrypted blobs** (`AES-256-GCM`) encrypted on the user's device.

- Zero Google login, zero emails, zero logs.
- Passwords and encryption keys never leave KOMA.

## Deploy Free in 1 Minute

```bash
cd sync-worker
npx wrangler login
npx wrangler kv namespace create KOMA_VAULT
# Copy the returned namespace id into wrangler.toml
npx wrangler deploy
```

Copy your deployed URL (e.g. `https://koma-zero-knowledge-sync.<you>.workers.dev`) into **KOMA -> Settings -> Account & Sync**.
