export type ContentType =
  | 'MANGA'
  | 'MANHWA'
  | 'MANHUA'
  | 'HENTAI'
  | 'COMICS'
  | 'NOVEL'
  | 'ONE_SHOT'
  | 'DOUJINSHI'
  | 'IMAGE_SET'
  | 'ARTIST_CG'
  | 'GAME_CG'
  | 'OTHER';

export type MangaState = 'ONGOING' | 'FINISHED' | 'ABANDONED' | 'PAUSED' | 'UPCOMING' | 'RESTRICTED';

export type SortOrder =
  | 'UPDATED'
  | 'POPULARITY'
  | 'RATING'
  | 'NEWEST'
  | 'ALPHABETICAL'
  | 'ADDED'
  | 'RELEVANCE'
  | 'POPULARITY_TODAY'
  | 'POPULARITY_WEEK'
  | 'POPULARITY_MONTH';

export interface SourceInfo {
  name: string;
  title: string;
  locale: string;
  contentType: ContentType;
  isBroken: boolean;
  domain?: string;
  domains?: string[];
  sortOrders?: SortOrder[];
  isSearchSupported?: boolean;
  verified?: boolean;
}

export interface MangaTag {
  title: string;
  key: string;
  source: string;
}

export interface MangaChapter {
  id: string;
  title: string | null;
  number: number;
  volume: number;
  url: string;
  scanlator: string | null;
  uploadDate: number;
  branch: string | null;
  source: string;
}

export interface Manga {
  id: string;
  title: string;
  altTitles: string[];
  url: string;
  publicUrl: string;
  rating: number;
  contentRating: string | null;
  coverUrl: string | null;
  largeCoverUrl: string | null;
  state: MangaState | null;
  authors: string[];
  description: string | null;
  source: string;
  tags: MangaTag[];
  chapters: MangaChapter[] | null;
}

export interface MangaPage {
  id: string;
  url: string;
  resolvedUrl?: string;
  preview: string | null;
  source: string;
}

export interface FilterMetadata {
  domain: string;
  domains: string[];
  sortOrders: SortOrder[];
  capabilities: {
    isMultipleTagsSupported: boolean;
    isTagsExclusionSupported: boolean;
    isSearchSupported: boolean;
    isSearchWithFiltersSupported: boolean;
  };
  availableTags: MangaTag[];
  availableStates: MangaState[];
  availableContentRating: string[];
  availableContentTypes: ContentType[];
  availableDemographics: string[];
  availableLocales: string[];
}

export interface EngineStatus {
  ready: boolean;
  port: number | null;
  url: string | null;
  sourcesCount: number;
  error: string | null;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface LibraryEntry {
  key: string;
  manga: Manga;
  categoryIds: string[];
  addedAt: number;
  lastReadAt?: number;
  lastCheckedAt?: number;
  unreadCount?: number;
  totalChapters?: number;
  readChapterIds?: string[];
  knownChapterIds?: string[];
}

export interface UpdateEntry {
  id: string;
  mangaKey: string;
  manga: Manga;
  chapter: MangaChapter;
  discoveredAt: number;
}

export interface ReadingStats {
  chaptersCompleted: number;
  pagesRead: number;
  readingMinutes: number;
  activeDays: string[];
  genreCounts: Record<string, number>;
}

export interface TrackerConfig {
  anilistToken?: string;
  anilistUser?: {
    id: number;
    name: string;
    avatar?: string;
  };
}

export interface AniListMediaInfo {
  id: number;
  title: string;
  bannerImage?: string;
  coverImage?: string;
  averageScore?: number;
  popularity?: number;
  chapters?: number;
  status?: string;
  siteUrl?: string;
  relations: Array<{
    id: number;
    title: string;
    relationType: string;
    format: string;
    cover?: string;
  }>;
  recommendations: Array<{
    id: number;
    title: string;
    cover?: string;
    score?: number;
  }>;
}

export interface HistoryEntry {
  key: string;
  manga: Manga;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  pageIndex: number;
  totalPages: number;
  updatedAt: number;
}

export interface DownloadedChapter {
  key: string;
  source: string;
  mangaId: string;
  mangaTitle: string;
  coverUrl?: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  cbzPath: string;
  pageCount: number;
  sizeBytes: number;
  downloadedAt: number;
}

export type ReaderMode = 'webtoon' | 'rtl' | 'ltr' | 'double';
export type FitMode = 'width' | 'height' | 'original';

export interface AppSettings {
  preferredLanguages: string[];
  showNsfw: boolean;
  pinnedSources: string[];
  defaultReaderMode: ReaderMode;
  defaultFitMode: FitMode;
  mangaReaderPrefs: Record<string, { mode?: ReaderMode; fit?: FitMode }>;
  autoBingeNextChapter: boolean;
  brightness: number;
  contrast: number;
  warmth: number;
  oledInk: boolean;
  oledTrueBlack: boolean;
  ambientGlow: boolean;
  preloadCount: number;
  autoScrollSpeed: number;
  discordRpc: boolean;
  discordClientId: string;
  autoCheckUpdates: boolean;
  githubRepo: string;
  hasCompletedTutorial: boolean;
  lastSeenVersion: string;
  pendingWhatsNewNotes: string;
}

export interface UpdateCheckResult {
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

export interface UpdateProgress {
  downloaded: number;
  total: number;
  percent: number;
  status: 'downloading' | 'installing' | 'error';
  message?: string;
}

export interface ReaderSession {
  manga: Manga;
  chapters: MangaChapter[];
  chapterIndex: number;
  initialPage?: number;
}

export interface ShowcaseRow {
  title: string;
  subtitle: string;
  source: string;
  items: Manga[];
  loading: boolean;
}

export interface HomeCacheSnapshot {
  version?: number;
  hourEpoch: number;
  heroItems: Manga[];
  rows: ShowcaseRow[];
  savedAt: number;
}

export type NavView =
  | 'home'
  | 'library'
  | 'updates'
  | 'explore'
  | 'downloads'
  | 'sources'
  | 'settings';

declare global {
  interface Window {
    noctis: {
      minimize: () => Promise<void>;
      maximize: () => Promise<boolean>;
      close: () => Promise<void>;
      toggleFullscreen: () => Promise<boolean>;
      isFullscreen: () => Promise<boolean>;
      getEngineStatus: () => Promise<EngineStatus>;
      restartEngine: () => Promise<EngineStatus>;
      getEngineLogs: () => Promise<string[]>;
      solveCloudflare: (url: string) => Promise<{ ok: boolean; injected: number; error?: string }>;
      getCategories: () => Promise<Category[]>;
      saveCategories: (categories: Category[]) => Promise<Category[]>;
      getLibrary: () => Promise<LibraryEntry[]>;
      upsertLibrary: (entry: LibraryEntry) => Promise<LibraryEntry[]>;
      removeLibrary: (key: string) => Promise<LibraryEntry[]>;
      getUpdates: () => Promise<UpdateEntry[]>;
      checkUpdates: () => Promise<{
        updates: UpdateEntry[];
        library: LibraryEntry[];
        newCount: number;
      }>;
      clearUpdates: () => Promise<UpdateEntry[]>;
      getStats: () => Promise<ReadingStats>;
      recordStats: (payload: {
        pagesDelta?: number;
        chapterCompleted?: boolean;
        minutesDelta?: number;
        tags?: string[];
      }) => Promise<ReadingStats>;
      getHistory: () => Promise<HistoryEntry[]>;
      upsertHistory: (entry: HistoryEntry) => Promise<HistoryEntry[]>;
      removeHistory: (key: string) => Promise<HistoryEntry[]>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      getHomeCache: () => Promise<HomeCacheSnapshot | null>;
      saveHomeCache: (snapshot: HomeCacheSnapshot) => Promise<void>;
      getDownloads: () => Promise<DownloadedChapter[]>;
      downloadChapter: (payload: {
        source: string;
        mangaId: string;
        mangaTitle: string;
        coverUrl?: string;
        chapter: MangaChapter;
      }) => Promise<DownloadedChapter>;
      deleteDownload: (key: string) => Promise<DownloadedChapter[]>;
      getOfflinePages: (cbzPath: string) => Promise<string[]>;
      importLocalArchive: () => Promise<LibraryEntry[]>;
      importLocalFolder: () => Promise<LibraryEntry[]>;
      importLocalPaths: (paths: string[]) => Promise<LibraryEntry[]>;
      exportBackup: () => Promise<boolean>;
      importBackup: () => Promise<boolean>;
      getTrackerConfig: () => Promise<TrackerConfig>;
      setAniListToken: (token: string) => Promise<TrackerConfig>;
      disconnectAniList: () => Promise<TrackerConfig>;
      fetchAniListMetadata: (title: string, altTitle?: string | null) => Promise<AniListMediaInfo | null>;
      syncAniListProgress: (
        mangaTitle: string,
        chapterNumber: number,
      ) => Promise<{ synced: boolean; progress?: number }>;
      getAniListLists: () => Promise<
        Array<{
          id: number;
          title: string;
          progress: number;
          totalChapters?: number;
          cover?: string;
          status: string;
        }>
      >;
      setDiscordReading: (mangaTitle: string, chapterLabel: string) => Promise<void>;
      clearDiscord: () => Promise<void>;
      getSplashCovers: () => Promise<string[]>;
      getAppVersion: () => Promise<string>;
      checkForUpdate: (repo?: string) => Promise<UpdateCheckResult>;
      downloadAndInstallUpdate: (payload: {
        downloadUrl: string;
        assetName: string;
        latestVersion: string;
        notes: string;
      }) => Promise<{ started: boolean; error?: string }>;
      onEngineStatus: (cb: (status: EngineStatus) => void) => () => void;
      onNavigateBack: (cb: () => void) => () => void;
      onDownloadProgress: (cb: (data: { key: string; done: number; total: number }) => void) => () => void;
      onUpdateProgress: (cb: (data: UpdateProgress) => void) => () => void;
    };
  }
}
