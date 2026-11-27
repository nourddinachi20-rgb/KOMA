import { contextBridge, ipcRenderer } from 'electron';

export const noctisApi = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window:isFullscreen') as Promise<boolean>,

  // Engine lifecycle & CF solver
  getEngineStatus: () => ipcRenderer.invoke('engine:status'),
  restartEngine: () => ipcRenderer.invoke('engine:restart'),
  getEngineLogs: () => ipcRenderer.invoke('engine:logs') as Promise<string[]>,
  solveCloudflare: (url: string) => ipcRenderer.invoke('engine:solveCloudflare', url),

  // Library, categories, updates, stats, history, settings
  getCategories: () => ipcRenderer.invoke('storage:getCategories'),
  saveCategories: (categories: unknown[]) => ipcRenderer.invoke('storage:saveCategories', categories),
  getLibrary: () => ipcRenderer.invoke('storage:getLibrary'),
  upsertLibrary: (entry: unknown) => ipcRenderer.invoke('storage:upsertLibrary', entry),
  removeLibrary: (key: string) => ipcRenderer.invoke('storage:removeLibrary', key),
  getUpdates: () => ipcRenderer.invoke('library:getUpdates'),
  checkUpdates: () => ipcRenderer.invoke('library:checkUpdates'),
  clearUpdates: () => ipcRenderer.invoke('library:clearUpdates'),
  getStats: () => ipcRenderer.invoke('stats:get'),
  recordStats: (payload: unknown) => ipcRenderer.invoke('stats:record', payload),
  getHistory: () => ipcRenderer.invoke('storage:getHistory'),
  upsertHistory: (entry: unknown) => ipcRenderer.invoke('storage:upsertHistory', entry),
  removeHistory: (key: string) => ipcRenderer.invoke('storage:removeHistory', key),
  getSettings: () => ipcRenderer.invoke('storage:getSettings'),
  saveSettings: (patch: unknown) => ipcRenderer.invoke('storage:saveSettings', patch),
  getHomeCache: () => ipcRenderer.invoke('storage:getHomeCache'),
  saveHomeCache: (snapshot: unknown) => ipcRenderer.invoke('storage:saveHomeCache', snapshot),

  // Downloads & local CBZ / folder archives
  getDownloads: () => ipcRenderer.invoke('downloads:list'),
  downloadChapter: (payload: unknown) => ipcRenderer.invoke('downloads:start', payload),
  deleteDownload: (key: string) => ipcRenderer.invoke('downloads:delete', key),
  getOfflinePages: (cbzPath: string) => ipcRenderer.invoke('downloads:pages', cbzPath) as Promise<string[]>,
  importLocalArchive: () => ipcRenderer.invoke('local:importArchive'),
  importLocalFolder: () => ipcRenderer.invoke('local:importFolder'),
  importLocalPaths: (paths: string[]) => ipcRenderer.invoke('local:importPaths', paths),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),

  // AniList tracker & Discord RPC
  getTrackerConfig: () => ipcRenderer.invoke('tracker:getConfig'),
  setAniListToken: (token: string) => ipcRenderer.invoke('tracker:setAniListToken', token),
  disconnectAniList: () => ipcRenderer.invoke('tracker:disconnectAniList'),
  fetchAniListMetadata: (title: string, altTitle?: string | null) =>
    ipcRenderer.invoke('tracker:fetchMetadata', { title, altTitle }),
  syncAniListProgress: (mangaTitle: string, chapterNumber: number) =>
    ipcRenderer.invoke('tracker:syncProgress', { mangaTitle, chapterNumber }),
  getAniListLists: () => ipcRenderer.invoke('tracker:getLists'),
  setDiscordReading: (mangaTitle: string, chapterLabel: string) =>
    ipcRenderer.invoke('discord:setReading', { mangaTitle, chapterLabel }),
  clearDiscord: () => ipcRenderer.invoke('discord:clear'),
  getSplashCovers: () => ipcRenderer.invoke('app:getSplashCovers'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdate: (repo?: string) => ipcRenderer.invoke('updater:check', repo),
  downloadAndInstallUpdate: (payload: {
    downloadUrl: string;
    assetName: string;
    latestVersion: string;
    notes: string;
  }) => ipcRenderer.invoke('updater:install', payload),

  onEngineStatus: (cb: (status: unknown) => void) => {
    const listener = (_: Electron.IpcRendererEvent, status: unknown) => cb(status);
    ipcRenderer.on('engine:status', listener);
    return () => ipcRenderer.removeListener('engine:status', listener);
  },

  onNavigateBack: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('nav:back', listener);
    return () => ipcRenderer.removeListener('nav:back', listener);
  },

  onDownloadProgress: (cb: (data: { key: string; done: number; total: number }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { key: string; done: number; total: number }) => cb(data);
    ipcRenderer.on('downloads:progress', listener);
    return () => ipcRenderer.removeListener('downloads:progress', listener);
  },

  onUpdateProgress: (cb: (data: unknown) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on('update:progress', listener);
    return () => ipcRenderer.removeListener('update:progress', listener);
  },
};

contextBridge.exposeInMainWorld('noctis', noctisApi);
