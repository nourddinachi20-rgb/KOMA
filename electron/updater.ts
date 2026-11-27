import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { storageManager } from './storageManager';

export interface DesktopUpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  notes: string;
  publishedAt?: string;
  downloadUrl?: string;
  assetName?: string;
  assetSize?: number;
  htmlUrl?: string;
  error?: string;
}

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export async function checkDesktopUpdate(repoInput?: string): Promise<DesktopUpdateCheckResult> {
  const currentVersion = app.getVersion() || '1.0.0';
  const repo = (repoInput || storageManager.getSettings().githubRepo || 'nourddinachi20-rgb/KOMA').trim();

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'KOMA-Updater',
      },
    });
    if (!res.ok) {
      return {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        releaseName: `v${currentVersion}`,
        notes: '',
        error:
          res.status === 404
            ? `No GitHub releases published yet for ${repo}`
            : `GitHub API returned ${res.status}`,
      };
    }

    const json = (await res.json()) as {
      tag_name?: string;
      name?: string;
      body?: string;
      published_at?: string;
      html_url?: string;
      assets?: Array<{ name: string; browser_download_url: string; size: number }>;
    };

    const latestVersion = (json.tag_name || json.name || currentVersion).replace(/^v/i, '').trim();
    const assets = json.assets ?? [];
    const exeAsset =
      assets.find((a) => a.name.toLowerCase().includes('portable') && a.name.toLowerCase().endsWith('.exe')) ??
      assets.find((a) => a.name.toLowerCase().endsWith('.exe'));

    return {
      currentVersion,
      latestVersion,
      hasUpdate: compareSemver(latestVersion, currentVersion) > 0,
      releaseName: json.name || json.tag_name || `v${latestVersion}`,
      notes: json.body || '',
      publishedAt: json.published_at,
      downloadUrl: exeAsset?.browser_download_url,
      assetName: exeAsset?.name,
      assetSize: exeAsset?.size,
      htmlUrl: json.html_url,
    };
  } catch (err) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseName: `v${currentVersion}`,
      notes: '',
      error: err instanceof Error ? err.message : 'Update check failed',
    };
  }
}

export async function downloadAndInstallDesktopUpdate(
  payload: { downloadUrl: string; assetName: string; latestVersion: string; notes: string },
  onProgress: (p: {
    downloaded: number;
    total: number;
    percent: number;
    status: 'downloading' | 'installing' | 'error';
    message?: string;
  }) => void,
): Promise<{ started: boolean; error?: string }> {
  try {
    const res = await fetch(payload.downloadUrl, {
      headers: { 'User-Agent': 'KOMA-Updater' },
    });
    if (!res.ok || !res.body) {
      throw new Error(`Download failed (${res.status})`);
    }

    const total = Number(res.headers.get('content-length') || 0);
    const tempDir = path.join(app.getPath('temp'), 'koma-update');
    fs.mkdirSync(tempDir, { recursive: true });
    const safeName = (payload.assetName || 'KOMA-Portable.exe').replace(/[^a-zA-Z0-9._-]/g, '_');
    const downloadedPath = path.join(tempDir, safeName);

    const reader = res.body.getReader();
    const out = fs.createWriteStream(downloadedPath);
    let downloaded = 0;
    let lastEmit = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          out.write(Buffer.from(value));
          downloaded += value.length;
          const now = Date.now();
          if (now - lastEmit > 120) {
            lastEmit = now;
            const percent = total > 0 ? Math.min(99, Math.round((downloaded / total) * 100)) : 50;
            onProgress({ downloaded, total, percent, status: 'downloading' });
          }
        }
      }
      await new Promise<void>((resolve, reject) => {
        out.on('finish', resolve);
        out.on('error', reject);
        out.end();
      });
    } catch (e) {
      out.destroy();
      throw e;
    }
    onProgress({ downloaded, total: downloaded, percent: 100, status: 'installing' });

    // Persist release notes so the restarted app opens "What's New in ver : XXX" once
    storageManager.saveSettings({
      pendingWhatsNewNotes: payload.notes || '',
    });

    const portableExe = process.env.PORTABLE_EXECUTABLE_FILE;
    const targetExe = portableExe && fs.existsSync(portableExe) ? portableExe : downloadedPath;

    const psScriptPath = path.join(tempDir, 'apply-koma-update.ps1');
    const esc = (p: string) => p.replace(/'/g, "''");
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
Wait-Process -Id ${process.pid} -Timeout 15
Start-Sleep -Milliseconds 600
if ('${esc(targetExe)}' -ne '${esc(downloadedPath)}') {
  Copy-Item -LiteralPath '${esc(downloadedPath)}' -Destination '${esc(targetExe)}' -Force
}
Start-Process -FilePath '${esc(targetExe)}'
`;
    fs.writeFileSync(psScriptPath, script, 'utf8');

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', psScriptPath],
      { detached: true, stdio: 'ignore' },
    );
    child.unref();

    setTimeout(() => {
      app.quit();
    }, 350);

    return { started: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Update failed';
    onProgress({ downloaded: 0, total: 0, percent: 0, status: 'error', message: msg });
    return { started: false, error: msg };
  }
}
