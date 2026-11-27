import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron';
import { solveCloudflareChallenge } from './cfSolver';
import { discordRpc } from './discordRpc';
import { engineManager } from './engineManager';
import { storageManager } from './storageManager';
import { trackerManager } from './trackerManager';
import { checkDesktopUpdate, downloadAndInstallDesktopUpdate } from './updater';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'noctis-cbz',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1060,
    minHeight: 700,
    backgroundColor: '#000000',
    icon: path.join(app.getAppPath(), 'assets', 'icon.ico'),
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.on('app-command', (_, cmd) => {
    if (cmd === 'browser-backward') {
      mainWindow?.webContents.send('nav:back');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:fullscreen', () => {
    if (!mainWindow) return false;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  });
  ipcMain.handle('window:isFullscreen', () => mainWindow?.isFullScreen() ?? false);

  ipcMain.handle('engine:status', () => engineManager.getStatus());
  ipcMain.handle('engine:restart', async () => {
    engineManager.stop();
    return engineManager.start((status) => {
      mainWindow?.webContents.send('engine:status', status);
    });
  });
  ipcMain.handle('engine:logs', () => engineManager.getLogs());
  ipcMain.handle('engine:solveCloudflare', async (_, url: string) => {
    const status = engineManager.getStatus();
    if (!status.ready || !status.url) return { ok: false, injected: 0, error: 'Engine offline' };
    return solveCloudflareChallenge(url, status.url);
  });

  ipcMain.handle('storage:getCategories', () => storageManager.getCategories());
  ipcMain.handle('storage:saveCategories', (_, cats) => storageManager.saveCategories(cats));
  ipcMain.handle('storage:getLibrary', () => storageManager.getLibrary());
  ipcMain.handle('storage:upsertLibrary', (_, entry) => storageManager.upsertLibraryEntry(entry));
  ipcMain.handle('storage:removeLibrary', (_, key) => storageManager.removeLibraryEntry(key));
  ipcMain.handle('library:getUpdates', () => storageManager.getUpdates());
  ipcMain.handle('library:clearUpdates', () => storageManager.clearUpdates());
  ipcMain.handle('library:checkUpdates', async () => {
    const status = engineManager.getStatus();
    if (!status.ready || !status.url) {
      return { updates: storageManager.getUpdates(), library: storageManager.getLibrary(), newCount: 0 };
    }
    return storageManager.checkLibraryUpdates(status.url);
  });

  ipcMain.handle('stats:get', () => storageManager.getStats());
  ipcMain.handle('stats:record', (_, payload) => storageManager.recordStats(payload));

  ipcMain.handle('storage:getHistory', () => storageManager.getHistory());
  ipcMain.handle('storage:upsertHistory', (_, entry) => storageManager.upsertHistory(entry));
  ipcMain.handle('storage:removeHistory', (_, key) => storageManager.removeHistory(key));
  ipcMain.handle('storage:getSettings', () => storageManager.getSettings());
  ipcMain.handle('storage:saveSettings', (_, patch) => {
    const saved = storageManager.saveSettings(patch);
    discordRpc.setClientId(saved.discordClientId);
    discordRpc.setEnabled(saved.discordRpc);
    return saved;
  });
  ipcMain.handle('storage:getHomeCache', () => storageManager.getHomeCache());
  ipcMain.handle('storage:saveHomeCache', (_, snapshot) => storageManager.saveHomeCache(snapshot));

  ipcMain.handle('downloads:list', () => storageManager.getDownloads());
  ipcMain.handle('downloads:delete', (_, key) => storageManager.deleteDownload(key));
  ipcMain.handle('downloads:start', async (_, payload) => {
    const status = engineManager.getStatus();
    if (!status.ready || !status.url) throw new Error('Engine is not ready');
    const key = `${payload.source}::${payload.mangaId}::${payload.chapter.id}`;
    return storageManager.downloadChapter(status.url, payload, (done, total) => {
      mainWindow?.webContents.send('downloads:progress', { key, done, total });
    });
  });

  ipcMain.handle('downloads:pages', (_, cbzPath: string) => {
    const entries = storageManager.listCbzEntries(cbzPath);
    if (cbzPath.startsWith('folder://')) {
      const dir = cbzPath.slice('folder://'.length);
      return entries.map(
        (file) => `noctis-cbz://folder?path=${encodeURIComponent(dir)}&file=${encodeURIComponent(file)}`,
      );
    }
    return entries.map(
      (entry) => `noctis-cbz://archive?path=${encodeURIComponent(cbzPath)}&entry=${encodeURIComponent(entry)}`,
    );
  });

  ipcMain.handle('local:importArchive', async () => {
    if (!mainWindow) return [];
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Manga Archives (.cbz / .zip)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Manga Archives', extensions: ['cbz', 'zip'] }],
    });
    if (res.canceled) return [];
    return res.filePaths.map((p) => storageManager.importLocalArchive(p));
  });

  ipcMain.handle('local:importFolder', async () => {
    if (!mainWindow) return [];
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Manga Folder',
      properties: ['openDirectory', 'multiSelections'],
    });
    if (res.canceled) return [];
    return res.filePaths.map((p) => storageManager.importLocalFolder(p));
  });

  ipcMain.handle('local:importPaths', (_, paths: string[]) => storageManager.importLocalPaths(paths));

  ipcMain.handle('backup:export', async () => {
    if (!mainWindow) return false;
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Export KOMA Backup',
      defaultPath: `koma-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return false;
    fs.writeFileSync(res.filePath, JSON.stringify(storageManager.exportBackup(), null, 2), 'utf8');
    return true;
  });

  ipcMain.handle('backup:import', async () => {
    if (!mainWindow) return false;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Restore KOMA Backup',
      properties: ['openFile'],
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return false;
    const raw = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8')) as Record<string, unknown>;
    storageManager.importBackup(raw);
    return true;
  });

  ipcMain.handle('tracker:getConfig', () => trackerManager.getConfig());
  ipcMain.handle('tracker:setAniListToken', (_, token: string) =>
    trackerManager.setAniListToken(token),
  );
  ipcMain.handle('tracker:disconnectAniList', () => trackerManager.disconnectAniList());
  ipcMain.handle('tracker:fetchMetadata', (_, p: string | { title: string; altTitle?: string | null }) => {
    if (typeof p === 'string') return trackerManager.fetchMetadata(p);
    return trackerManager.fetchMetadata(p.title, p.altTitle);
  });
  ipcMain.handle('tracker:syncProgress', (_, p: { mangaTitle: string; chapterNumber: number }) =>
    trackerManager.syncProgress(p.mangaTitle, p.chapterNumber),
  );
  ipcMain.handle('tracker:getLists', () => trackerManager.getUserLists());

  ipcMain.handle('discord:setReading', (_, p: { mangaTitle: string; chapterLabel: string }) =>
    discordRpc.setReadingActivity(p.mangaTitle, p.chapterLabel),
  );
  ipcMain.handle('discord:clear', () => discordRpc.clear());

  ipcMain.handle('app:getVersion', () => app.getVersion() || '1.0.0');
  ipcMain.handle('updater:check', (_, repo?: string) => checkDesktopUpdate(repo));
  ipcMain.handle(
    'updater:install',
    (
      _,
      payload: { downloadUrl: string; assetName: string; latestVersion: string; notes: string },
    ) =>
      downloadAndInstallDesktopUpdate(payload, (progress) => {
        mainWindow?.webContents.send('update:progress', progress);
      }),
  );

  ipcMain.handle('app:getSplashCovers', () => {
    const imgDir = path.join(os.homedir(), '.koma-cache', 'images');
    if (!fs.existsSync(imgDir)) return [];

    const out: string[] = [];
    const seen = new Set<string>();
    const addHash = (hash: string) => {
      if (seen.has(hash) || out.length >= 18) return;
      const bin = path.join(imgDir, `${hash}.bin`);
      if (fs.existsSync(bin)) {
        seen.add(hash);
        out.push(`noctis-cbz://cache-bin?id=${hash}`);
      }
    };

    // Prioritize cached covers matching Home Hero + Shelves
    const hc = storageManager.getHomeCache() as {
      heroItems?: Array<{ source?: string; coverUrl?: string; largeCoverUrl?: string }>;
      rows?: Array<{ items?: Array<{ source?: string; coverUrl?: string; largeCoverUrl?: string }> }>;
    } | null;
    if (hc) {
      const candidates = [
        ...(hc.heroItems ?? []),
        ...((hc.rows ?? []).flatMap((r) => r.items ?? [])),
      ];
      for (const m of candidates) {
        const u = m.coverUrl || m.largeCoverUrl;
        if (!u) continue;
        const hash = crypto
          .createHash('sha256')
          .update(`${m.source ?? ''}|${u}`)
          .digest('hex');
        addHash(hash);
      }
    }

    // Fill remaining slots from local SSD image cache
    if (out.length < 18) {
      try {
        const files = fs.readdirSync(imgDir);
        for (const f of files) {
          if (out.length >= 18) break;
          if (f.endsWith('.bin')) addHash(f.slice(0, -4));
        }
      } catch {
        // Ignore
      }
    }
    return out;
  });
}

app.whenReady().then(async () => {
  protocol.handle('noctis-cbz', async (request) => {
    const parsed = new URL(request.url);
    if (parsed.hostname === 'cache-bin') {
      const id = parsed.searchParams.get('id') ?? '';
      if (!/^[a-f0-9]{64}$/i.test(id)) {
        return new Response('Invalid id', { status: 400 });
      }
      const imgDir = path.join(os.homedir(), '.koma-cache', 'images');
      const binPath = path.join(imgDir, `${id}.bin`);
      const metaPath = path.join(imgDir, `${id}.meta`);
      try {
        const [buf, mime] = await Promise.all([
          fs.promises.readFile(binPath),
          fs.promises.readFile(metaPath, 'utf8').catch(() => 'image/jpeg'),
        ]);
        return new Response(new Uint8Array(buf), {
          headers: { 'Content-Type': mime.trim() || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }
    if (parsed.hostname === 'folder') {
      const folderPath = parsed.searchParams.get('path') ?? '';
      const file = parsed.searchParams.get('file') ?? '';
      const data = storageManager.readFolderFile(folderPath, file);
      if (!data) return new Response('Not found', { status: 404 });
      return new Response(new Uint8Array(data.buffer), {
        headers: { 'Content-Type': data.mime },
      });
    }
    const cbzPath = parsed.searchParams.get('path') ?? '';
    const entry = parsed.searchParams.get('entry') ?? '';
    const data = storageManager.readCbzEntry(cbzPath, entry);
    if (!data) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(new Uint8Array(data.buffer), {
      headers: { 'Content-Type': data.mime },
    });
  });

  const initSettings = storageManager.getSettings();
  discordRpc.setClientId(initSettings.discordClientId);
  discordRpc.setEnabled(initSettings.discordRpc);
  registerIpc();
  createWindow();
  void engineManager.start((status) => {
    mainWindow?.webContents.send('engine:status', status);
  });
});

app.on('before-quit', () => {
  discordRpc.disconnect();
  engineManager.stop();
});

app.on('window-all-closed', () => {
  discordRpc.disconnect();
  engineManager.stop();
  if (process.platform !== 'darwin') app.quit();
});
