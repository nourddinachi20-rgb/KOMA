import { create } from 'zustand';
import type {
  AppSettings,
  Category,
  DownloadedChapter,
  EngineStatus,
  FilterMetadata,
  HistoryEntry,
  LibraryEntry,
  Manga,
  MangaChapter,
  NavView,
  ReaderSession,
  ReadingStats,
  ShowcaseRow,
  SortOrder,
  SourceInfo,
  TrackerConfig,
  UpdateCheckResult,
  UpdateEntry,
  UpdateProgress,
} from '../types';
import {
  fetchChapterPages,
  fetchMangaDetails,
  fetchMangaList,
  fetchSources,
  getProxiedImageUrl,
} from '../utils/api';
import {
  base64ToUint8Array,
  parseAnyBackupBytes,
  type BackupSourceFormat,
} from '../utils/backupImporter';
import {
  remoteCreateAccount,
  remotePullVault,
  remotePushVault,
  remoteSignInAndPull,
  resolveSyncServerUrl,
  type SyncVaultPayload,
} from '../utils/syncClient';
import { restoreSyncCredentials, type SyncCredentials } from '../utils/syncCrypto';
import { applyCustomizationToDocument } from '../utils/theme';
import { closeAllPopovers } from '../components/CustomSelect';

export const HOUR_MS = 60 * 60 * 1000;

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed + 1;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type BootStage = 'hydrating' | 'engine' | 'warming' | 'ready';

export interface ToastItem {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface ExploreCacheEntry {
  items: Manga[];
  sortOrder: SortOrder;
  query: string;
}

interface AppState {
  bootStage: BootStage;
  engineStatus: EngineStatus;
  sources: SourceInfo[];
  sourcesLoading: boolean;
  verifyingSources: boolean;
  checkingUpdates: boolean;
  categories: Category[];
  library: LibraryEntry[];
  updates: UpdateEntry[];
  stats: ReadingStats;
  trackerConfig: TrackerConfig;
  history: HistoryEntry[];
  downloads: DownloadedChapter[];
  downloadProgress: Record<string, { done: number; total: number }>;
  settings: AppSettings;
  toasts: ToastItem[];

  homeHourEpoch: number;
  homeHeroItems: Manga[];
  homeRows: ShowcaseRow[];
  homeLoaded: boolean;
  detailsCache: Record<string, Manga>;
  filtersCache: Record<string, FilterMetadata>;
  exploreCache: Record<string, ExploreCacheEntry>;
  chapterPagesCache: Record<string, string[]>;
  failedSourceKeys: Record<string, boolean>;
  markSourceFailed: (key: string, failed: boolean) => void;
  syncSession: SyncCredentials | null;
  syncLastAt: number;
  syncBusy: boolean;
  syncCreateAccount: (serverUrl: string, username: string, password: string) => Promise<void>;
  syncSignIn: (serverUrl: string, username: string, password: string) => Promise<void>;
  syncPushNow: () => Promise<void>;
  syncSignOut: () => Promise<void>;

  activeView: NavView;
  exploreSource: string;
  selectedManga: Manga | null;
  readerSession: ReaderSession | null;
  commandOpen: boolean;
  commandQuery: string;
  appVersion: string;
  checkingAppUpdate: boolean;
  appUpdateInfo: UpdateCheckResult | null;
  appUpdateProgress: UpdateProgress | null;
  showWhatsNew: boolean;
  tutorialOpen: boolean;

  setShowWhatsNew: (open: boolean) => void;
  dismissWhatsNew: () => Promise<void>;
  completeTutorial: () => Promise<void>;
  replayTutorial: () => void;
  checkForAppUpdate: (silent?: boolean) => Promise<UpdateCheckResult | null>;
  installAppUpdate: () => Promise<void>;

  notify: (message: string, tone?: 'info' | 'success' | 'error') => void;
  dismissToast: (id: string) => void;
  setActiveView: (view: NavView) => void;
  setExploreSource: (source: string) => void;
  openManga: (manga: Manga) => void;
  closeManga: () => void;
  openReader: (session: ReaderSession) => void;
  closeReader: () => void;
  setCommandOpen: (open: boolean) => void;
  openCommandWithQuery: (query: string) => void;

  bootstrap: () => Promise<void>;
  loadHomeFeeds: (hourEpoch: number, force?: boolean) => Promise<void>;
  prefetchMangaDetails: (manga: Manga) => Promise<Manga | null>;
  prefetchChapterPages: (chapter: MangaChapter) => Promise<string[]>;
  setFilterCache: (source: string, meta: FilterMetadata) => void;
  setExploreCache: (source: string, entry: ExploreCacheEntry) => void;
  refreshEngine: () => Promise<void>;
  verifyWorkingSources: () => Promise<void>;
  checkLibraryUpdates: () => Promise<number>;
  clearUpdates: () => Promise<void>;
  markChapterRead: (manga: Manga, chapterId: string, read?: boolean, chapterNumber?: number) => Promise<void>;
  markPreviousChaptersRead: (manga: Manga, upToChapterId: string) => Promise<void>;
  migrateLibraryManga: (oldKey: string, newManga: Manga) => Promise<void>;
  migrateLibraryBatch: (pairs: Array<{ oldKey: string; newManga: Manga }>) => Promise<void>;
  recordReadingPulse: (pagesDelta: number, chapterCompleted: boolean, tags?: string[]) => Promise<void>;
  refreshTracker: () => Promise<void>;
  refreshAllData: () => Promise<void>;
  toggleLibraryManga: (manga: Manga, categoryIds?: string[]) => Promise<void>;
  updateLibraryCategories: (key: string, categoryIds: string[]) => Promise<void>;
  saveCategories: (categories: Category[]) => Promise<void>;
  recordHistory: (entry: HistoryEntry) => Promise<void>;
  removeHistory: (key: string) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  queueDownload: (manga: Manga, chapter: MangaChapter) => Promise<void>;
  deleteDownload: (key: string) => Promise<void>;
  importLocalArchives: () => Promise<void>;
  importLocalFolder: () => Promise<void>;
  importDroppedPaths: (paths: string[]) => Promise<void>;
  restoreUnifiedBackup: () => Promise<{
    ok: boolean;
    format?: BackupSourceFormat;
    libraryCount?: number;
    categoryCount?: number;
    historyCount?: number;
    unresolvedExternalCount?: number;
  }>;
}

const DEFAULT_SETTINGS: AppSettings = {
  preferredLanguages: ['en', 'fr', 'ar'],
  uiLanguage: 'en',
  uiTheme: 'oled',
  accentColor: '#FFFFFF',
  showNsfw: false,
  pinnedSources: [
    'MANGABALL_EN',
    'MANGADEX',
    'WEEBCENTRAL',
    'ASURASCANS',
    'MANGAPILL',
    'MANGAREAD',
    'LELMANGA',
    'TEAMXNOVEL',
  ],
  defaultReaderMode: 'webtoon',
  defaultFitMode: 'width',
  mangaReaderPrefs: {},
  autoBingeNextChapter: false,
  brightness: 100,
  contrast: 100,
  warmth: 0,
  oledInk: false,
  oledTrueBlack: true,
  ambientGlow: true,
  preloadCount: 4,
  autoScrollSpeed: 2,
  discordRpc: false,
  discordClientId: '',
  autoCheckUpdates: true,
  githubRepo: 'nourddinachi20-rgb/KOMA',
  hasCompletedTutorial: false,
  hasSeenWelcome: false,
  lastSeenVersion: '',
  pendingWhatsNewNotes: '',
  syncServerUrl: '',
  syncUsername: '',
  syncAuthHash: '',
  syncKeyJwk: '',
};

const ALLOWED_LOCALES = new Set(['en', 'fr', 'ar', '']);
const HOME_CACHE_VERSION = 2;
const HOME_NOISY_SOURCES = new Set(['MANGAPILL']);
const inFlightDetails = new Map<string, Promise<Manga | null>>();
const inFlightPages = new Map<string, Promise<string[]>>();
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

async function mergeAndPersistVault(
  localCategories: Category[],
  localLibrary: LibraryEntry[],
  localHistory: HistoryEntry[],
  payload: SyncVaultPayload,
) {
  const catMap = new Map<string, Category>();
  for (const c of localCategories) catMap.set(c.id, c);
  for (const c of payload.categories ?? []) if (!catMap.has(c.id)) catMap.set(c.id, c);

  const libMap = new Map<string, LibraryEntry>();
  for (const l of localLibrary) libMap.set(l.key, l);
  for (const l of payload.library ?? []) {
    const prev = libMap.get(l.key);
    if (!prev) {
      libMap.set(l.key, l);
    } else {
      const readIds = Array.from(
        new Set([...(prev.readChapterIds ?? []), ...(l.readChapterIds ?? [])]),
      );
      libMap.set(l.key, {
        ...(l.lastReadAt && (!prev.lastReadAt || l.lastReadAt > prev.lastReadAt) ? l : prev),
        categoryIds: Array.from(new Set([...prev.categoryIds, ...l.categoryIds])),
        readChapterIds: readIds,
      });
    }
  }

  const histMap = new Map<string, HistoryEntry>();
  for (const h of localHistory) histMap.set(h.key, h);
  for (const h of payload.history ?? []) {
    const prev = histMap.get(h.key);
    if (!prev || h.updatedAt > prev.updatedAt) histMap.set(h.key, h);
  }

  await window.noctis.applyBackupData({
    categories: Array.from(catMap.values()),
    library: Array.from(libMap.values()),
    history: Array.from(histMap.values()).sort((a, b) => b.updatedAt - a.updatedAt),
  });
}

function scheduleAutoSync() {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    const state = useAppStore.getState();
    const resolvedUrl = resolveSyncServerUrl(state.settings.syncServerUrl);
    if (!state.syncSession || !resolvedUrl) return;
    void remotePushVault(resolvedUrl, state.syncSession, {
      categories: state.categories,
      library: state.library,
      history: state.history,
      stats: state.stats,
      syncedAt: Date.now(),
    })
      .then((ts) => {
        useAppStore.setState({ syncLastAt: ts });
      })
      .catch(() => {
        // Silent failure; next change or manual Sync Now retries
      });
  }, 2500);
}

export const useAppStore = create<AppState>((set, get) => ({
  bootStage: 'hydrating',
  engineStatus: { ready: false, port: null, url: null, sourcesCount: 0, error: null },
  sources: [],
  sourcesLoading: false,
  verifyingSources: false,
  checkingUpdates: false,
  categories: [],
  library: [],
  updates: [],
  stats: { chaptersCompleted: 0, pagesRead: 0, readingMinutes: 0, activeDays: [], genreCounts: {} },
  trackerConfig: {},
  history: [],
  downloads: [],
  downloadProgress: {},
  settings: DEFAULT_SETTINGS,
  toasts: [],

  homeHourEpoch: Math.floor(Date.now() / HOUR_MS),
  homeHeroItems: [],
  homeRows: [],
  homeLoaded: false,
  detailsCache: {},
  filtersCache: {},
  exploreCache: {},
  chapterPagesCache: {},
  failedSourceKeys: {},
  markSourceFailed: (key, failed) =>
    set((s) => {
      const next = { ...s.failedSourceKeys };
      if (failed) next[key] = true;
      else delete next[key];
      return { failedSourceKeys: next };
    }),
  syncSession: null,
  syncLastAt: 0,
  syncBusy: false,

  activeView: 'home',
  exploreSource: 'MANGABALL_EN',
  selectedManga: null,
  readerSession: null,
  commandOpen: false,
  commandQuery: '',
  appVersion: '1.0.0',
  checkingAppUpdate: false,
  appUpdateInfo: null,
  appUpdateProgress: null,
  showWhatsNew: false,
  tutorialOpen: false,

  setShowWhatsNew: (showWhatsNew) => set({ showWhatsNew }),

  dismissWhatsNew: async () => {
    const version = get().appVersion;
    set({ showWhatsNew: false });
    await get().updateSettings({ lastSeenVersion: version, pendingWhatsNewNotes: '' });
  },

  completeTutorial: async () => {
    const version = get().appVersion;
    set({ tutorialOpen: false });
    await get().updateSettings({ hasCompletedTutorial: true, lastSeenVersion: version });
  },

  replayTutorial: () => set({ tutorialOpen: true }),

  checkForAppUpdate: async (silent = false) => {
    set({ checkingAppUpdate: true });
    try {
      const res = await window.noctis.checkForUpdate(get().settings.githubRepo);
      set({ appUpdateInfo: res, checkingAppUpdate: false });
      if (!silent) {
        if (res.hasUpdate) {
          get().notify(`Update available: v${res.latestVersion}`, 'info');
        } else if (res.error) {
          get().notify(res.error, 'info');
        } else {
          get().notify(`KOMA v${res.currentVersion} is up to date`, 'success');
        }
      }
      return res;
    } catch {
      set({ checkingAppUpdate: false });
      if (!silent) get().notify('Update check failed', 'error');
      return null;
    }
  },

  installAppUpdate: async () => {
    const info = get().appUpdateInfo;
    if (!info?.downloadUrl) {
      get().notify('No compatible installer (.exe / .apk) found on latest release', 'error');
      return;
    }
    set({
      appUpdateProgress: {
        downloaded: 0,
        total: info.assetSize ?? 0,
        percent: 0,
        status: 'downloading',
      },
    });
    const res = await window.noctis.downloadAndInstallUpdate({
      downloadUrl: info.downloadUrl,
      assetName: info.assetName || 'KOMA-Update',
      latestVersion: info.latestVersion,
      notes: info.notes || '',
    });
    if (!res.started && res.error) {
      get().notify(res.error, 'error');
      set({ appUpdateProgress: null });
    }
  },

  notify: (message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 3600);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setActiveView: (activeView) => {
    closeAllPopovers();
    set({ activeView });
  },
  setExploreSource: (exploreSource) => {
    closeAllPopovers();
    set({ exploreSource, activeView: 'explore' });
  },
  openManga: (selectedManga) => {
    closeAllPopovers();
    set({ selectedManga });
  },
  closeManga: () => {
    closeAllPopovers();
    set({ selectedManga: null });
  },
  openReader: (readerSession) => {
    closeAllPopovers();
    set({ readerSession });
  },
  closeReader: () => {
    closeAllPopovers();
    set({ readerSession: null });
    void window.noctis.clearDiscord();
  },
  setCommandOpen: (commandOpen) => {
    if (commandOpen) closeAllPopovers();
    set((s) => ({ commandOpen, commandQuery: commandOpen ? s.commandQuery : '' }));
  },
  openCommandWithQuery: (commandQuery) => {
    closeAllPopovers();
    set({ commandOpen: true, commandQuery });
  },

  setFilterCache: (source, meta) =>
    set((s) => ({ filtersCache: { ...s.filtersCache, [source]: meta } })),

  setExploreCache: (source, entry) =>
    set((s) => ({ exploreCache: { ...s.exploreCache, [source]: entry } })),

  prefetchMangaDetails: async (manga) => {
    const key = `${manga.source}::${manga.id}`;
    const cached = get().detailsCache[key];
    if (cached && cached.chapters !== null) return cached;
    if (manga.source === 'LOCAL') return manga;

    const existingPromise = inFlightDetails.get(key);
    if (existingPromise) return existingPromise;

    const { engineStatus, sources } = get();
    if (!engineStatus.ready || !engineStatus.url) return null;

    const promise = (async () => {
      // Imported Mihon/Komikku entry: resolve real KOMA manga on the mapped source on first open
      if (manga.id.startsWith('mihon-') && sources.some((s) => s.name === manga.source)) {
        const candidates = await fetchMangaList(engineStatus.url!, manga.source, {
          query: manga.title,
        }).catch(() => []);
        if (candidates.length > 0) {
          const normTitle = manga.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          const best =
            candidates.find(
              (c) => c.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normTitle,
            ) ?? candidates[0];
          const resolvedFull = await fetchMangaDetails(engineStatus.url!, best).catch(() => null);
          if (resolvedFull) {
            const newKey = `${resolvedFull.source}::${resolvedFull.id}`;
            if (get().library.some((e) => e.key === key)) {
              await get().migrateLibraryManga(key, resolvedFull);
            }
            set((s) => ({
              detailsCache: { ...s.detailsCache, [key]: resolvedFull, [newKey]: resolvedFull },
              selectedManga: s.selectedManga?.id === manga.id ? resolvedFull : s.selectedManga,
            }));
            return resolvedFull;
          }
        }
      }

      const full = await fetchMangaDetails(engineStatus.url!, manga);
      set((s) => {
        const nextFailed = { ...s.failedSourceKeys };
        delete nextFailed[key];
        return {
          detailsCache: { ...s.detailsCache, [key]: full },
          failedSourceKeys: nextFailed,
        };
      });
      return full;
    })()
      .catch(() => {
        set((s) => ({ failedSourceKeys: { ...s.failedSourceKeys, [key]: true } }));
        return null;
      })
      .finally(() => {
        inFlightDetails.delete(key);
      });

    inFlightDetails.set(key, promise);
    return promise;
  },

  prefetchChapterPages: async (chapter) => {
    const cacheKey = `${chapter.source}::${chapter.id}`;
    const cached = get().chapterPagesCache[cacheKey];
    if (cached && cached.length > 0) return cached;

    const existing = inFlightPages.get(cacheKey);
    if (existing) return existing;

    const { engineStatus, downloads } = get();

    const promise = (async () => {
      if (chapter.source === 'LOCAL') {
        return await window.noctis.getOfflinePages(chapter.url);
      }
      const offline = downloads.find((d) => d.chapterId === chapter.id && d.source === chapter.source);
      if (offline) {
        return await window.noctis.getOfflinePages(offline.cbzPath);
      }
      if (!engineStatus.ready || !engineStatus.url) return [];
      const raw = await fetchChapterPages(engineStatus.url, chapter);
      return raw.map((p) => getProxiedImageUrl(engineStatus.url, p.source, p.resolvedUrl || p.url));
    })()
      .then((urls) => {
        if (urls.length > 0) {
          set((s) => ({ chapterPagesCache: { ...s.chapterPagesCache, [cacheKey]: urls } }));
        }
        return urls;
      })
      .catch(() => [])
      .finally(() => {
        inFlightPages.delete(cacheKey);
      });

    inFlightPages.set(cacheKey, promise);
    return promise;
  },

  loadHomeFeeds: async (hourEpoch, force = false) => {
    const { engineStatus, sources, settings, homeLoaded, homeHourEpoch } = get();
    if (!engineStatus.ready || !engineStatus.url || sources.length === 0) return;
    if (!force && homeLoaded && homeHourEpoch === hourEpoch) return;

    const preferredSources = settings.pinnedSources.filter(
      (name) => !HOME_NOISY_SOURCES.has(name) && sources.some((s) => s.name === name),
    );
    const activeSources = (
      preferredSources.length > 0
        ? preferredSources
        : sources
            .filter(
              (s) =>
                !HOME_NOISY_SOURCES.has(s.name) &&
                (settings.preferredLanguages.includes(s.locale) || s.locale === ''),
            )
            .map((s) => s.name)
    ).slice(0, 5);

    const rowTitles = [
      'Trending Worldwide',
      'Top Manga Hits',
      'Most Read Series',
      'Top Action & Manhwa',
      'Fan Favorites',
    ];

    if (get().homeRows.length === 0) {
      set({
        homeRows: activeSources.map((src, idx) => ({
          title: rowTitles[idx] ?? 'Top Popular',
          subtitle: sources.find((s) => s.name === src)?.title ?? src,
          source: src,
          items: [],
          loading: true,
        })),
      });
    }

    const builtRows: ShowcaseRow[] = activeSources.map((src, idx) => ({
      title: rowTitles[idx] ?? 'Top Popular',
      subtitle: sources.find((s) => s.name === src)?.title ?? src,
      source: src,
      items: [],
      loading: true,
    }));

    await Promise.all(
      activeSources.map(async (src, idx) => {
        try {
          const srcMeta = sources.find((s) => s.name === src);
          const supported = srcMeta?.sortOrders ?? [];
          const popularityOptions = (['POPULARITY_WEEK', 'POPULARITY_MONTH', 'POPULARITY'] as SortOrder[]).filter(
            (o) => supported.includes(o),
          );
          const order: SortOrder =
            popularityOptions.length > 0
              ? popularityOptions[(hourEpoch + idx) % popularityOptions.length]
              : supported[0] ?? 'POPULARITY';

          const items = await fetchMangaList(engineStatus.url!, src, {
            offset: 0,
            order,
          });
          const valid = items.filter((m) => m.title && m.coverUrl);
          // Keep top 4 overall hits leading each shelf, gently rotate top 5-16 each hour
          const topTier = valid.slice(0, 4);
          const midTier = seededShuffle(valid.slice(4, 16), hourEpoch + idx * 17);
          const cleanItems = [...topTier, ...midTier].slice(0, 12);

          builtRows[idx] = { ...builtRows[idx], items: cleanItems, loading: false };
        } catch {
          builtRows[idx] = { ...builtRows[idx], loading: false };
        }
      }),
    );

    // Assemble Hero Spotlight round-robin from settled rows in priority order (never race order)
    const collectedHero: Manga[] = [];
    for (let rank = 0; rank < 4 && collectedHero.length < 10; rank++) {
      for (const row of builtRows) {
        const cand = row.items[rank];
        if (!cand) continue;
        if (!collectedHero.some((x) => x.title.toLowerCase() === cand.title.toLowerCase())) {
          collectedHero.push(cand);
        }
        if (collectedHero.length >= 10) break;
      }
    }

    const finalHero = collectedHero.length > 0 ? collectedHero : get().homeHeroItems;
    const finalRows = builtRows.some((r) => r.items.length > 0) ? builtRows : get().homeRows;
    set({
      homeHourEpoch: hourEpoch,
      homeHeroItems: finalHero,
      homeRows: finalRows,
      homeLoaded: true,
    });

    if (finalRows.some((r) => r.items.length > 0)) {
      window.noctis.saveHomeCache({
        version: HOME_CACHE_VERSION,
        hourEpoch,
        heroItems: finalHero,
        rows: finalRows,
        savedAt: Date.now(),
      });
    }

    // Lightly enrich only the top 3 spotlight entries so launch stays whisper-fast
    for (const m of finalHero.slice(0, 3)) {
      void get().prefetchMangaDetails(m);
    }
  },

  bootstrap: async () => {
    const api = window.noctis;
    const [categories, library, updates, stats, trackerConfig, history, downloads, settings, homeCache, engineStatus, appVersion] =
      await Promise.all([
        api.getCategories(),
        api.getLibrary(),
        api.getUpdates(),
        api.getStats(),
        api.getTrackerConfig(),
        api.getHistory(),
        api.getDownloads(),
        api.getSettings(),
        api.getHomeCache(),
        api.getEngineStatus(),
        api.getAppVersion().catch(() => '1.0.0'),
      ]);

    const currentHour = Math.floor(Date.now() / HOUR_MS);
    const validHomeCache =
      homeCache &&
      homeCache.version === HOME_CACHE_VERSION &&
      homeCache.rows?.length > 0
        ? homeCache
        : null;
    const cacheIsFresh =
      Boolean(validHomeCache) &&
      validHomeCache!.hourEpoch === currentHour &&
      Date.now() - (validHomeCache!.savedAt ?? 0) < 20 * 60 * 1000;

    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    applyCustomizationToDocument(mergedSettings);

    let restoredSync: SyncCredentials | null = null;
    if (mergedSettings.syncUsername && mergedSettings.syncAuthHash && mergedSettings.syncKeyJwk) {
      try {
        const jwk = JSON.parse(mergedSettings.syncKeyJwk) as JsonWebKey;
        restoredSync = await restoreSyncCredentials(
          mergedSettings.syncUsername,
          mergedSettings.syncAuthHash,
          jwk,
        );
      } catch {
        restoredSync = null;
      }
    }

    const welcomeDone = Boolean(mergedSettings.hasSeenWelcome || restoredSync);
    const needsTutorial = welcomeDone && !settings.hasCompletedTutorial;
    const needsWhatsNew = welcomeDone && !needsTutorial && settings.lastSeenVersion !== appVersion;

    set({
      categories,
      library,
      updates,
      stats,
      trackerConfig,
      history,
      downloads,
      settings: mergedSettings,
      engineStatus,
      appVersion,
      syncSession: restoredSync,
      tutorialOpen: needsTutorial,
      showWhatsNew: needsWhatsNew,
      bootStage: engineStatus.ready ? (cacheIsFresh ? 'ready' : 'warming') : 'engine',
      ...(validHomeCache
        ? {
            homeHeroItems: validHomeCache.heroItems ?? [],
            homeRows: validHomeCache.rows ?? [],
            homeHourEpoch: validHomeCache.hourEpoch ?? currentHour,
            homeLoaded: cacheIsFresh,
          }
        : {}),
    });

    if (restoredSync && resolveSyncServerUrl(mergedSettings.syncServerUrl)) {
      void (async () => {
        try {
          const { payload, updatedAt } = await remotePullVault(
            mergedSettings.syncServerUrl,
            restoredSync,
          );
          if (payload) {
            await mergeAndPersistVault(
              get().categories,
              get().library,
              get().history,
              payload,
            );
            await get().refreshAllData();
          }
          set({ syncLastAt: updatedAt || Date.now() });
        } catch {
          // Silent retry on next mutation or manual sync
        }
      })();
    }

    api.onDownloadProgress(({ key, done, total }) => {
      set((s) => ({
        downloadProgress: { ...s.downloadProgress, [key]: { done, total } },
      }));
    });

    api.onUpdateProgress((appUpdateProgress) => {
      set({ appUpdateProgress });
    });

    const handleEngineReady = async (status: EngineStatus) => {
      set({ engineStatus: status });
      if (!status.ready || !status.url) {
        if (status.error) set({ bootStage: 'ready' });
        return;
      }

      if (!cacheIsFresh) set({ bootStage: 'warming' });
      set({ sourcesLoading: true });
      try {
        const rawSources = await fetchSources(status.url, false);
        const sources = rawSources.filter((s) => ALLOWED_LOCALES.has(s.locale));
        const preferredFirst =
          sources.find((s) => settings.pinnedSources.includes(s.name))?.name ||
          sources[0]?.name ||
          'MANGABALL_EN';
        set({ sources, sourcesLoading: false, exploreSource: preferredFirst });

        if (cacheIsFresh) {
          set({ bootStage: 'ready' });
        } else if (validHomeCache) {
          set({ bootStage: 'ready' });
          void get().loadHomeFeeds(currentHour, true);
        } else {
          await Promise.race([
            get().loadHomeFeeds(currentHour, true),
            new Promise((r) => setTimeout(r, 1800)),
          ]);
          set({ bootStage: 'ready' });
        }

        if (settings.autoCheckUpdates && library.length > 0) {
          const oldest = Math.min(...library.map((l) => l.lastCheckedAt ?? 0));
          if (Date.now() - oldest > 30 * 60 * 1000) {
            setTimeout(() => {
              void get().checkLibraryUpdates();
            }, 8000);
          }
        }
      } catch {
        set({ sourcesLoading: false, bootStage: 'ready' });
      }
    };

    const unsubEngine = api.onEngineStatus((nextStatus) => {
      void handleEngineReady(nextStatus);
    });

    if (engineStatus.ready && engineStatus.url) {
      unsubEngine();
      await handleEngineReady(engineStatus);
    } else {
      setTimeout(() => {
        if (get().bootStage !== 'ready') set({ bootStage: 'ready' });
      }, 7500);
    }
  },

  refreshEngine: async () => {
    const engineStatus = await window.noctis.restartEngine();
    set({ engineStatus });
    if (engineStatus.ready && engineStatus.url) {
      const rawSources = await fetchSources(engineStatus.url, false);
      set({ sources: rawSources.filter((s) => ALLOWED_LOCALES.has(s.locale)) });
      get().notify('Parser engine restarted', 'success');
    }
  },

  verifyWorkingSources: async () => {
    const { engineStatus, verifyingSources } = get();
    if (!engineStatus.ready || !engineStatus.url || verifyingSources) return;
    set({ verifyingSources: true });
    try {
      await fetch(`${engineStatus.url}/api/sources/verify`, { method: 'POST' });
      const rawSources = await fetchSources(engineStatus.url, false);
      const filtered = rawSources.filter((s) => ALLOWED_LOCALES.has(s.locale));
      set({ sources: filtered });
      get().notify(`${filtered.length} working sources verified`, 'success');
    } finally {
      set({ verifyingSources: false });
    }
  },

  checkLibraryUpdates: async () => {
    if (get().checkingUpdates) return 0;
    set({ checkingUpdates: true });
    try {
      const res = await window.noctis.checkUpdates();
      set({ updates: res.updates, library: res.library });
      if (res.newCount > 0) {
        get().notify(`${res.newCount} new chapter${res.newCount === 1 ? '' : 's'} found`, 'success');
      } else {
        get().notify('Library is up to date', 'info');
      }
      return res.newCount;
    } finally {
      set({ checkingUpdates: false });
    }
  },

  clearUpdates: async () => {
    const updates = await window.noctis.clearUpdates();
    set({ updates });
  },

  markChapterRead: async (manga, chapterId, read = true, chapterNumber = 0) => {
    const key = `${manga.source}::${manga.id}`;
    const entry = get().library.find((x) => x.key === key);
    if (!entry) {
      if (read && chapterNumber > 0) {
        void window.noctis.syncAniListProgress(manga.title, chapterNumber);
      }
      return;
    }
    const readSet = new Set(entry.readChapterIds ?? []);
    if (read) readSet.add(chapterId);
    else readSet.delete(chapterId);

    const chapters = manga.chapters ?? entry.manga.chapters ?? [];
    const unreadCount = chapters.filter((c) => !readSet.has(c.id)).length;
    const library = await window.noctis.upsertLibrary({
      ...entry,
      readChapterIds: Array.from(readSet),
      unreadCount,
      lastReadAt: Date.now(),
    });
    set({ library });

    if (read && chapterNumber > 0) {
      void window.noctis.syncAniListProgress(manga.title, chapterNumber).then((r) => {
        if (r.synced) get().notify(`Synced Ch. ${r.progress} to AniList`, 'success');
      });
    }
    scheduleAutoSync();
  },

  markPreviousChaptersRead: async (manga, upToChapterId) => {
    const key = `${manga.source}::${manga.id}`;
    const entry = get().library.find((x) => x.key === key);
    if (!entry) return;
    const chapters = manga.chapters ?? entry.manga.chapters ?? [];
    const idx = chapters.findIndex((c) => c.id === upToChapterId);
    if (idx < 0) return;

    const readSet = new Set(entry.readChapterIds ?? []);
    for (let i = 0; i <= idx; i++) {
      readSet.add(chapters[i].id);
    }
    const unreadCount = chapters.filter((c) => !readSet.has(c.id)).length;
    const library = await window.noctis.upsertLibrary({
      ...entry,
      readChapterIds: Array.from(readSet),
      unreadCount,
      lastReadAt: Date.now(),
    });
    set({ library });
    get().notify('Marked previous chapters as read', 'info');
    scheduleAutoSync();
  },

  migrateLibraryManga: async (oldKey, newManga) => {
    const oldEntry = get().library.find((x) => x.key === oldKey);
    const oldHist = get().history.find((h) => h.key === oldKey);
    const newFull = (await get().prefetchMangaDetails(newManga)) ?? newManga;
    const newChapters = newFull.chapters ?? [];

    const readChapterIds: string[] = [];
    if (oldEntry?.readChapterIds?.length) {
      const oldChapters = oldEntry.manga.chapters ?? [];
      const readNums = new Set(
        oldChapters
          .filter((c) => oldEntry.readChapterIds!.includes(c.id))
          .map((c) => c.number),
      );
      for (const ch of newChapters) {
        if (readNums.has(ch.number)) readChapterIds.push(ch.id);
      }
    }

    const newKey = `${newFull.source}::${newFull.id}`;
    const newEntry: LibraryEntry = {
      key: newKey,
      manga: newFull,
      categoryIds: oldEntry?.categoryIds ?? [get().categories[0]?.id ?? 'reading'],
      addedAt: oldEntry?.addedAt ?? Date.now(),
      lastReadAt: Date.now(),
      totalChapters: newChapters.length,
      knownChapterIds: newChapters.map((c) => c.id),
      readChapterIds,
      unreadCount: newChapters.filter((c) => !readChapterIds.includes(c.id)).length,
    };

    if (oldEntry) {
      await window.noctis.removeLibrary(oldKey);
    }
    const library = await window.noctis.upsertLibrary(newEntry);

    let history = get().history;
    if (oldHist) {
      const matched =
        newChapters.find((c) => c.number === oldHist.chapterNumber) ?? newChapters[0];
      if (matched) {
        await window.noctis.removeHistory(oldKey);
        history = await window.noctis.upsertHistory({
          key: newKey,
          manga: newFull,
          chapterId: matched.id,
          chapterNumber: matched.number,
          chapterTitle: matched.title || `Chapter ${matched.number || ''}`,
          pageIndex: oldHist.pageIndex,
          totalPages: oldHist.totalPages,
          updatedAt: Date.now(),
        });
      }
    }

    const currentSelected = get().selectedManga;
    const shouldUpdateSelected =
      currentSelected && `${currentSelected.source}::${currentSelected.id}` === oldKey;
    const nextFailed = { ...get().failedSourceKeys };
    delete nextFailed[oldKey];
    delete nextFailed[newKey];

    set({
      library,
      history,
      failedSourceKeys: nextFailed,
      ...(shouldUpdateSelected ? { selectedManga: newFull } : {}),
    });
    if (shouldUpdateSelected) {
      get().notify(`Migrated to ${newFull.source}`, 'success');
    }
    scheduleAutoSync();
  },

  migrateLibraryBatch: async (pairs) => {
    if (pairs.length === 0) return;
    const state = get();
    const libMap = new Map<string, LibraryEntry>();
    for (const e of state.library) libMap.set(e.key, e);
    const histMap = new Map<string, HistoryEntry>();
    for (const h of state.history) histMap.set(h.key, h);
    const nextFailed = { ...state.failedSourceKeys };
    const defaultCat = state.categories[0]?.id ?? 'reading';
    const now = Date.now();

    for (const { oldKey, newManga } of pairs) {
      const oldEntry = libMap.get(oldKey);
      const oldHist = histMap.get(oldKey);
      const newChapters = newManga.chapters ?? [];

      const readChapterIds: string[] = [];
      if (oldEntry?.readChapterIds?.length) {
        const oldChapters = oldEntry.manga.chapters ?? [];
        const readNums = new Set(
          oldChapters
            .filter((c) => oldEntry.readChapterIds!.includes(c.id))
            .map((c) => c.number),
        );
        for (const ch of newChapters) {
          if (readNums.has(ch.number)) readChapterIds.push(ch.id);
        }
      }

      const newKey = `${newManga.source}::${newManga.id}`;
      const newEntry: LibraryEntry = {
        key: newKey,
        manga: newManga,
        categoryIds: oldEntry?.categoryIds ?? [defaultCat],
        addedAt: oldEntry?.addedAt ?? now,
        lastReadAt: now,
        totalChapters: newChapters.length,
        knownChapterIds: newChapters.map((c) => c.id),
        readChapterIds,
        unreadCount: newChapters.filter((c) => !readChapterIds.includes(c.id)).length,
      };

      libMap.delete(oldKey);
      libMap.set(newKey, newEntry);
      delete nextFailed[oldKey];
      delete nextFailed[newKey];

      if (oldHist) {
        const matched =
          newChapters.find((c) => c.number === oldHist.chapterNumber) ?? newChapters[0];
        if (matched) {
          histMap.delete(oldKey);
          histMap.set(newKey, {
            key: newKey,
            manga: newManga,
            chapterId: matched.id,
            chapterNumber: matched.number,
            chapterTitle: matched.title || `Chapter ${matched.number || ''}`,
            pageIndex: oldHist.pageIndex,
            totalPages: oldHist.totalPages,
            updatedAt: now,
          });
        }
      }
    }

    const nextLibrary = Array.from(libMap.values());
    const nextHistory = Array.from(histMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);

    await window.noctis.applyBackupData({
      categories: state.categories,
      library: nextLibrary,
      history: nextHistory,
    });
    set({ library: nextLibrary, history: nextHistory, failedSourceKeys: nextFailed });
    scheduleAutoSync();
  },

  recordReadingPulse: async (pagesDelta, chapterCompleted, tags) => {
    const stats = await window.noctis.recordStats({
      pagesDelta,
      chapterCompleted,
      minutesDelta: chapterCompleted ? 3 : 0,
      tags,
    });
    set({ stats });
  },

  refreshTracker: async () => {
    const trackerConfig = await window.noctis.getTrackerConfig();
    set({ trackerConfig });
  },

  refreshAllData: async () => {
    const api = window.noctis;
    const [categories, library, updates, stats, trackerConfig, history, downloads, settings] =
      await Promise.all([
        api.getCategories(),
        api.getLibrary(),
        api.getUpdates(),
        api.getStats(),
        api.getTrackerConfig(),
        api.getHistory(),
        api.getDownloads(),
        api.getSettings(),
      ]);
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    applyCustomizationToDocument(mergedSettings);
    set({ categories, library, updates, stats, trackerConfig, history, downloads, settings: mergedSettings });
  },

  toggleLibraryManga: async (manga, categoryIds) => {
    const key = `${manga.source}::${manga.id}`;
    const exists = get().library.some((x) => x.key === key);
    if (exists) {
      const library = await window.noctis.removeLibrary(key);
      set({ library });
      get().notify('Removed from Library', 'info');
    } else {
      const defaultCat = get().categories[0]?.id ?? 'reading';
      const chapters = manga.chapters ?? [];
      const entry: LibraryEntry = {
        key,
        manga,
        categoryIds: categoryIds?.length ? categoryIds : [defaultCat],
        addedAt: Date.now(),
        totalChapters: chapters.length,
        knownChapterIds: chapters.map((c) => c.id),
        readChapterIds: [],
        unreadCount: 0,
      };
      const library = await window.noctis.upsertLibrary(entry);
      set({ library });
      get().notify(`Added "${manga.title}" to Library`, 'success');
    }
    scheduleAutoSync();
  },

  updateLibraryCategories: async (key, categoryIds) => {
    const existing = get().library.find((x) => x.key === key);
    if (!existing) return;
    const library = await window.noctis.upsertLibrary({ ...existing, categoryIds });
    set({ library });
    scheduleAutoSync();
  },

  saveCategories: async (categories) => {
    const saved = await window.noctis.saveCategories(categories);
    set({ categories: saved });
    scheduleAutoSync();
  },

  recordHistory: async (entry) => {
    const history = await window.noctis.upsertHistory(entry);
    set({ history });
    scheduleAutoSync();
  },

  removeHistory: async (key) => {
    const history = await window.noctis.removeHistory(key);
    set({ history });
  },

  updateSettings: async (patch) => {
    const saved = await window.noctis.saveSettings(patch);
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    applyCustomizationToDocument(merged);
    set({ settings: merged });
  },

  queueDownload: async (manga, chapter) => {
    const key = `${manga.source}::${manga.id}::${chapter.id}`;
    set((s) => ({
      downloadProgress: { ...s.downloadProgress, [key]: { done: 0, total: 1 } },
    }));
    try {
      await window.noctis.downloadChapter({
        source: manga.source,
        mangaId: manga.id,
        mangaTitle: manga.title,
        coverUrl: manga.largeCoverUrl || manga.coverUrl || undefined,
        chapter,
      });
      const downloads = await window.noctis.getDownloads();
      set((s) => {
        const nextProg = { ...s.downloadProgress };
        delete nextProg[key];
        return { downloads, downloadProgress: nextProg };
      });
      get().notify(`Downloaded Ch. ${chapter.number || ''}`, 'success');
    } catch (err) {
      set((s) => {
        const nextProg = { ...s.downloadProgress };
        delete nextProg[key];
        return { downloadProgress: nextProg };
      });
      get().notify(err instanceof Error ? err.message : 'Download failed', 'error');
      throw err;
    }
  },

  deleteDownload: async (key) => {
    const downloads = await window.noctis.deleteDownload(key);
    set({ downloads });
  },

  importLocalArchives: async () => {
    const imported = await window.noctis.importLocalArchive();
    if (imported.length > 0) {
      const library = await window.noctis.getLibrary();
      set({ library, activeView: 'library' });
      get().notify(`Imported ${imported.length} archive(s)`, 'success');
    }
  },

  importLocalFolder: async () => {
    const imported = await window.noctis.importLocalFolder();
    if (imported.length > 0) {
      const library = await window.noctis.getLibrary();
      set({ library, activeView: 'library' });
      get().notify(`Imported ${imported.length} folder(s)`, 'success');
    }
  },

  importDroppedPaths: async (paths) => {
    const imported = await window.noctis.importLocalPaths(paths);
    if (imported.length > 0) {
      const library = await window.noctis.getLibrary();
      set({ library, activeView: 'library' });
      get().notify(`Imported ${imported.length} item(s)`, 'success');
    }
  },

  restoreUnifiedBackup: async () => {
    const raw = await window.noctis.pickBackupRaw();
    if (!raw || !raw.base64) return { ok: false };

    const bytes = base64ToUint8Array(raw.base64);
    const parsed = await parseAnyBackupBytes(bytes, raw.fileName, get().sources);

    if (parsed.format === 'koma') {
      await window.noctis.applyBackupData({
        categories: parsed.categories,
        library: parsed.library,
        history: parsed.history,
        ...(parsed.settings ? { settings: parsed.settings } : {}),
        ...(parsed.stats ? { stats: parsed.stats } : {}),
      });
      await get().refreshAllData();
      get().notify(`Restored KOMA backup (${parsed.library.length} series)`, 'success');
      return {
        ok: true,
        format: 'koma',
        libraryCount: parsed.library.length,
        categoryCount: parsed.categories.length,
        historyCount: parsed.history.length,
        unresolvedExternalCount: 0,
      };
    }

    // Kotatsu or Mihon/Komikku: merge cleanly into existing library/categories without wiping user data
    const existingCats = [...get().categories];
    const catIdRemap = new Map<string, string>();
    let nextOrder = existingCats.length;
    let addedCats = 0;

    for (const c of parsed.categories) {
      const byName = existingCats.find(
        (ex) => ex.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
      );
      if (byName) {
        catIdRemap.set(c.id, byName.id);
      } else {
        existingCats.push({ ...c, order: nextOrder++ });
        catIdRemap.set(c.id, c.id);
        addedCats++;
      }
    }

    const mergedLibMap = new Map<string, LibraryEntry>();
    for (const item of get().library) {
      mergedLibMap.set(item.key, { ...item });
    }

    let addedLib = 0;
    for (const entry of parsed.library) {
      const remappedCats = Array.from(
        new Set(entry.categoryIds.map((id) => catIdRemap.get(id) ?? id)),
      );
      const prev = mergedLibMap.get(entry.key);
      if (prev) {
        prev.categoryIds = Array.from(new Set([...prev.categoryIds, ...remappedCats]));
        if (entry.readChapterIds?.length) {
          prev.readChapterIds = Array.from(
            new Set([...(prev.readChapterIds ?? []), ...entry.readChapterIds]),
          );
        }
      } else {
        mergedLibMap.set(entry.key, { ...entry, categoryIds: remappedCats });
        addedLib++;
      }
    }

    const mergedHistMap = new Map<string, HistoryEntry>();
    for (const h of get().history) mergedHistMap.set(h.key, h);
    let addedHist = 0;
    for (const h of parsed.history) {
      const prev = mergedHistMap.get(h.key);
      if (!prev || h.updatedAt > prev.updatedAt) {
        if (!prev) addedHist++;
        mergedHistMap.set(h.key, h);
      }
    }

    const mergedLib = Array.from(mergedLibMap.values());
    const mergedHist = Array.from(mergedHistMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);

    await window.noctis.applyBackupData({
      categories: existingCats,
      library: mergedLib,
      history: mergedHist,
    });
    await get().refreshAllData();

    const label = parsed.format === 'kotatsu' ? 'Kotatsu' : 'Mihon / Komikku';
    get().notify(
      `Imported ${label} backup: ${addedLib} new series (${parsed.library.length} total)`,
      'success',
    );
    scheduleAutoSync();

    return {
      ok: true,
      format: parsed.format,
      libraryCount: parsed.library.length,
      categoryCount: addedCats,
      historyCount: addedHist,
      unresolvedExternalCount: parsed.unresolvedExternalCount,
    };
  },

  syncCreateAccount: async (serverUrl, username, password) => {
    set({ syncBusy: true });
    try {
      const state = get();
      const payload: SyncVaultPayload = {
        categories: state.categories,
        library: state.library,
        history: state.history,
        stats: state.stats,
        syncedAt: Date.now(),
      };
      const resolvedUrl = resolveSyncServerUrl(serverUrl);
      const creds = await remoteCreateAccount(resolvedUrl, username, password, payload);
      await get().updateSettings({
        syncServerUrl: serverUrl.trim(),
        syncUsername: creds.username,
        syncAuthHash: creds.authHash,
        syncKeyJwk: JSON.stringify(creds.keyJwk),
      });
      set({ syncSession: creds, syncLastAt: payload.syncedAt });
      get().notify(`Account "${creds.username}" created (End-to-End Encrypted)`, 'success');
    } finally {
      set({ syncBusy: false });
    }
  },

  syncSignIn: async (serverUrl, username, password) => {
    set({ syncBusy: true });
    try {
      const resolvedUrl = resolveSyncServerUrl(serverUrl);
      const { creds, payload, updatedAt } = await remoteSignInAndPull(
        resolvedUrl,
        username,
        password,
      );
      if (payload) {
        await mergeAndPersistVault(
          get().categories,
          get().library,
          get().history,
          payload,
        );
        await get().refreshAllData();
      }
      await get().updateSettings({
        syncServerUrl: serverUrl.trim(),
        syncUsername: creds.username,
        syncAuthHash: creds.authHash,
        syncKeyJwk: JSON.stringify(creds.keyJwk),
      });
      set({ syncSession: creds, syncLastAt: updatedAt || Date.now() });
      get().notify(`Synced encrypted vault for "${creds.username}"`, 'success');
    } finally {
      set({ syncBusy: false });
    }
  },

  syncPushNow: async () => {
    const { syncSession, settings } = get();
    const resolvedUrl = resolveSyncServerUrl(settings.syncServerUrl);
    if (!syncSession || !resolvedUrl) return;
    set({ syncBusy: true });
    try {
      const now = Date.now();
      const ts = await remotePushVault(resolvedUrl, syncSession, {
        categories: get().categories,
        library: get().library,
        history: get().history,
        stats: get().stats,
        syncedAt: now,
      });
      set({ syncLastAt: ts });
      get().notify('Encrypted sync complete', 'success');
    } finally {
      set({ syncBusy: false });
    }
  },

  syncSignOut: async () => {
    if (autoSyncTimer) {
      clearTimeout(autoSyncTimer);
      autoSyncTimer = null;
    }
    set({ syncSession: null, syncLastAt: 0 });
    await get().updateSettings({
      syncUsername: '',
      syncAuthHash: '',
      syncKeyJwk: '',
    });
    get().notify('Signed out of sync account', 'info');
  },
}));
