import { BrowserWindow, session } from 'electron';

export async function solveCloudflareChallenge(
  targetUrl: string,
  engineUrl: string,
): Promise<{ ok: boolean; injected: number; error?: string }> {
  let host = '';
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    return { ok: false, injected: 0, error: 'Invalid URL' };
  }

  const cfSession = session.fromPartition('persist:koma-cf');
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      session: cfSession,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await win.loadURL(targetUrl);

    // Wait up to 10s for Cloudflare JS challenge to clear
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (win.isDestroyed()) break;
      const title = await win.webContents.executeJavaScript('document.title').catch(() => '');
      const cookies = await cfSession.cookies.get({ url: targetUrl });
      const hasClearance = cookies.some((c) => c.name === 'cf_clearance');
      const isChallengePage =
        typeof title === 'string' &&
        (title.includes('Just a moment') || title.includes('Attention Required'));
      if (hasClearance || (!isChallengePage && title)) {
        break;
      }
      await new Promise((r) => setTimeout(r, 450));
    }

    const cookies = await cfSession.cookies.get({ url: targetUrl });
    const userAgent = win.webContents.getUserAgent();

    const payload = {
      host,
      userAgent,
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || host,
        path: c.path || '/',
        secure: c.secure,
        httpOnly: c.httpOnly,
        expiresAt: c.expirationDate ? Math.round(c.expirationDate * 1000) : Date.now() + 86_400_000 * 7,
      })),
    };

    const res = await fetch(`${engineUrl}/api/sources/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, injected: 0, error: `Engine rejected cookies (${res.status})` };
    }
    const data = (await res.json()) as { injected: number };
    return { ok: true, injected: data.injected };
  } catch (err) {
    return {
      ok: false,
      injected: 0,
      error: err instanceof Error ? err.message : 'CF solve failed',
    };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
