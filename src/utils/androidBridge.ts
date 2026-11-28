import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

interface KomaNativePluginInterface {
  call(options: { method: string; argsJson?: string }): Promise<{ json?: string; ok?: boolean }>;
  getSplashCoverPaths(): Promise<{ paths: string[] }>;
  getOfflinePagePaths(options: { cbzPath: string }): Promise<{ paths: string[] }>;
  pickCbzFiles(): Promise<{ json: string }>;
  pickBackupFile(): Promise<{ json?: string; base64?: string; fileName?: string }>;
  saveBackupFile(options: { json: string }): Promise<{ ok: boolean }>;
  solveCloudflare(options: { url: string }): Promise<{ ok: boolean; injected: number; error?: string }>;
  getEngineStatus(): Promise<{ ready: boolean; port: number | null; url: string | null; sourcesCount: number; safeTop?: number; safeBottom?: number; error: string | null }>;
  restartEngine(): Promise<{ ready: boolean; port: number | null; url: string | null; sourcesCount: number; safeTop?: number; safeBottom?: number; error: string | null }>;
  addListener(
    eventName: 'engineStatus' | 'downloadProgress' | 'updateProgress',
    listenerFunc: (data: any) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const KomaNative = registerPlugin<KomaNativePluginInterface>('KomaNative');

async function rpc<T>(method: string, args?: unknown): Promise<T> {
  const res = await KomaNative.call({
    method,
    argsJson: args === undefined ? '{}' : JSON.stringify(args),
  });
  return (res.json ? JSON.parse(res.json) : res) as T;
}

export function installAndroidBridgeIfNeeded(): void {
  if (typeof window === 'undefined') return;
  if (window.noctis) return; // Running inside Electron Desktop

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const engineListeners = new Set<(status: any) => void>();
  const backListeners = new Set<() => void>();
  const dlListeners = new Set<(data: { key: string; done: number; total: number }) => void>();
  const updateListeners = new Set<(data: any) => void>();

  void KomaNative.addListener('engineStatus', (status) => {
    if (typeof status?.safeTop === 'number' && status.safeTop > 0) {
      document.documentElement.style.setProperty('--koma-safe-top', `${status.safeTop}px`);
    }
    if (typeof status?.safeBottom === 'number' && status.safeBottom > 0) {
      document.documentElement.style.setProperty('--koma-safe-bottom', `${status.safeBottom}px`);
    }
    for (const cb of engineListeners) cb(status);
  });

  void KomaNative.addListener('downloadProgress', (data) => {
    for (const cb of dlListeners) cb(data);
  });

  void KomaNative.addListener('updateProgress', (data) => {
    for (const cb of updateListeners) cb(data);
  });

  void CapApp.addListener('backButton', ({ canGoBack }) => {
    if (backListeners.size > 0) {
      for (const cb of backListeners) cb();
    } else if (!canGoBack) {
      void CapApp.exitApp();
    }
  });

  window.noctis = {
    minimize: async () => {},
    maximize: async () => false,
    close: async () => {
      await CapApp.exitApp();
    },
    toggleFullscreen: async () => false,
    isFullscreen: async () => false,
    getEngineStatus: async () => {
      const st = await KomaNative.getEngineStatus();
      if (typeof st.safeTop === 'number' && st.safeTop > 0) {
        document.documentElement.style.setProperty('--koma-safe-top', `${st.safeTop}px`);
      }
      if (typeof st.safeBottom === 'number' && st.safeBottom > 0) {
        document.documentElement.style.setProperty('--koma-safe-bottom', `${st.safeBottom}px`);
      }
      return st;
    },
    restartEngine: () => KomaNative.restartEngine(),
    getEngineLogs: () => rpc<string[]>('getEngineLogs'),
    solveCloudflare: (url: string) => KomaNative.solveCloudflare({ url }),
    getCategories: () => rpc('getCategories'),
    saveCategories: (categories) => rpc('saveCategories', { categories }),
    getLibrary: () => rpc('getLibrary'),
    upsertLibrary: (entry) => rpc('upsertLibrary', { entry }),
    removeLibrary: (key) => rpc('removeLibrary', { key }),
    getUpdates: () => rpc('getUpdates'),
    checkUpdates: () => rpc('checkUpdates'),
    clearUpdates: () => rpc('clearUpdates'),
    getStats: () => rpc('getStats'),
    recordStats: (payload) => rpc('recordStats', payload),
    getHistory: () => rpc('getHistory'),
    upsertHistory: (entry) => rpc('upsertHistory', { entry }),
    removeHistory: (key) => rpc('removeHistory', { key }),
    getSettings: () => rpc('getSettings'),
    saveSettings: (patch) => rpc('saveSettings', { patch }),
    getHomeCache: () => rpc('getHomeCache'),
    saveHomeCache: (snapshot) => rpc('saveHomeCache', { snapshot }),
    getDownloads: () => rpc('getDownloads'),
    downloadChapter: (payload) => rpc('downloadChapter', payload),
    deleteDownload: (key) => rpc('deleteDownload', { key }),
    getOfflinePages: async (cbzPath: string) => {
      const res = await KomaNative.getOfflinePagePaths({ cbzPath });
      return (res.paths ?? []).map((p) => Capacitor.convertFileSrc(p));
    },
    importLocalArchive: async () => {
      const res = await KomaNative.pickCbzFiles();
      return JSON.parse(res.json || '[]');
    },
    importLocalFolder: async () => {
      const res = await KomaNative.pickCbzFiles();
      return JSON.parse(res.json || '[]');
    },
    importLocalPaths: async () => [],
    exportBackup: async () => {
      const json = await rpc<string>('exportBackupJson');
      const res = await KomaNative.saveBackupFile({ json });
      return Boolean(res.ok);
    },
    importBackup: async () => {
      const res = await KomaNative.pickBackupFile();
      if (!res.json) return false;
      return rpc<boolean>('importBackupJson', { json: res.json });
    },
    pickBackupRaw: async () => {
      const res = await KomaNative.pickBackupFile();
      if (res.base64) {
        return { fileName: res.fileName || 'backup', base64: res.base64 };
      }
      if (res.json) {
        const b64 = btoa(unescape(encodeURIComponent(res.json)));
        return { fileName: res.fileName || 'backup.json', base64: b64 };
      }
      return null;
    },
    applyBackupData: async (raw: Record<string, unknown>) =>
      rpc<boolean>('importBackupJson', { json: JSON.stringify(raw) }),
    getTrackerConfig: () => rpc('getTrackerConfig'),
    setAniListToken: (token: string) => rpc('setAniListToken', { token }),
    disconnectAniList: () => rpc('disconnectAniList'),
    fetchAniListMetadata: (title: string, altTitle?: string | null) =>
      rpc('fetchAniListMetadata', { title, altTitle }),
    syncAniListProgress: (mangaTitle: string, chapterNumber: number) =>
      rpc('syncAniListProgress', { mangaTitle, chapterNumber }),
    getAniListLists: () => rpc('getAniListLists'),
    setDiscordReading: async () => {},
    clearDiscord: async () => {},
    getSplashCovers: async () => {
      const res = await KomaNative.getSplashCoverPaths();
      return (res.paths ?? []).map((p) => Capacitor.convertFileSrc(p));
    },
    getAppVersion: () => rpc<string>('getAppVersion'),
    checkForUpdate: (repo?: string) => rpc('checkForUpdate', { repo }),
    downloadAndInstallUpdate: (payload) => rpc('downloadAndInstallUpdate', payload),
    onEngineStatus: (cb) => {
      engineListeners.add(cb);
      return () => {
        engineListeners.delete(cb);
      };
    },
    onNavigateBack: (cb) => {
      backListeners.add(cb);
      return () => {
        backListeners.delete(cb);
      };
    },
    onDownloadProgress: (cb) => {
      dlListeners.add(cb);
      return () => {
        dlListeners.delete(cb);
      };
    },
    onUpdateProgress: (cb) => {
      updateListeners.add(cb);
      return () => {
        updateListeners.delete(cb);
      };
    },
  };
}
