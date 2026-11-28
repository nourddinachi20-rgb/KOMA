import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { app } from 'electron';

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface LibraryEntry {
  key: string; // `${source}::${id}`
  manga: Record<string, unknown>;
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
  id: string; // `${mangaKey}::${chapter.id}`
  mangaKey: string;
  manga: Record<string, unknown>;
  chapter: Record<string, unknown>;
  discoveredAt: number;
}

export interface ReadingStats {
  chaptersCompleted: number;
  pagesRead: number;
  readingMinutes: number;
  activeDays: string[];
  genreCounts: Record<string, number>;
}

export interface HistoryEntry {
  key: string; // `${source}::${mangaId}`
  manga: Record<string, unknown>;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  pageIndex: number;
  totalPages: number;
  updatedAt: number;
}

export interface DownloadedChapter {
  key: string; // `${source}::${mangaId}::${chapterId}`
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

export interface AppSettings {
  preferredLanguages: string[];
  uiLanguage: 'en' | 'fr' | 'ar';
  uiTheme: 'oled' | 'dark' | 'paper';
  accentColor: string;
  showNsfw: boolean;
  pinnedSources: string[];
  defaultReaderMode: 'webtoon' | 'rtl' | 'ltr' | 'double';
  defaultFitMode: 'width' | 'height' | 'original';
  mangaReaderPrefs: Record<string, { mode?: 'webtoon' | 'rtl' | 'ltr' | 'double'; fit?: 'width' | 'height' | 'original' }>;
  autoBingeNextChapter: boolean;
  brightness: number;
  contrast: number;
  warmth: number;
  oledInk: boolean;
  oledTrueBlack: boolean;
  ambientGlow: boolean;
  preloadCount: number;
  chapterDupMode?: 'dedupe' | 'collapse' | 'all';
  mangaDupPrefs?: Record<string, 'dedupe' | 'collapse' | 'all'>;
  autoScrollSpeed: number;
  discordRpc: boolean;
  discordClientId: string;
  autoCheckUpdates: boolean;
  githubRepo: string;
  hasCompletedTutorial: boolean;
  hasSeenWelcome?: boolean;
  lastSeenVersion: string;
  pendingWhatsNewNotes: string;
  syncServerUrl?: string;
  syncUsername?: string;
  syncAuthHash?: string;
  syncKeyJwk?: string;
  deletedLibraryKeys?: Record<string, number>;
  persistedFailedKeys?: Record<string, boolean>;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'reading', name: 'Reading', order: 0 },
  { id: 'favorites', name: 'Favorites', order: 1 },
  { id: 'plan', name: 'Plan to Read', order: 2 },
  { id: 'completed', name: 'Completed', order: 3 },
];

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
  chapterDupMode: 'dedupe',
  mangaDupPrefs: {},
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
  deletedLibraryKeys: {},
  persistedFailedKeys: {},
};

const DEFAULT_STATS: ReadingStats = {
  chaptersCompleted: 0,
  pagesRead: 0,
  readingMinutes: 0,
  activeDays: [],
  genreCounts: {},
};

const KNOWN_DEAD_SOURCES = new Set([
  'MANGAPARK',
  'MANGASEE',
  'MANGALIFE',
  'COMICK',
  'COMICK_FUN',
  'REAPER_SCANS',
  'FLAMESCANS',
  'LUMINOUSSCANS',
  'MANHUARM',
  'MANGA_DEMON',
]);

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp']);

class StorageManager {
  private get baseDir(): string {
    const dir = path.join(app.getPath('userData'), 'noctis-data');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  get downloadsDir(): string {
    const dir = path.join(this.baseDir, 'downloads');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private readJson<T>(fileName: string, fallback: T): T {
    const filePath = path.join(this.baseDir, fileName);
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson<T>(fileName: string, data: T): void {
    const filePath = path.join(this.baseDir, fileName);
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  getCategories(): Category[] {
    const cats = this.readJson<Category[]>('categories.json', DEFAULT_CATEGORIES);
    return cats.length > 0 ? cats : DEFAULT_CATEGORIES;
  }

  saveCategories(categories: Category[]): Category[] {
    this.writeJson('categories.json', categories);
    return categories;
  }

  getLibrary(): LibraryEntry[] {
    return this.readJson<LibraryEntry[]>('library.json', []);
  }

  upsertLibraryEntry(entry: LibraryEntry): LibraryEntry[] {
    const lib = this.getLibrary();
    const idx = lib.findIndex((x) => x.key === entry.key);
    if (idx >= 0) {
      lib[idx] = { ...lib[idx], ...entry };
    } else {
      lib.unshift(entry);
    }
    this.writeJson('library.json', lib);
    return lib;
  }

  removeLibraryEntry(key: string): LibraryEntry[] {
    const lib = this.getLibrary().filter((x) => x.key !== key);
    this.writeJson('library.json', lib);
    return lib;
  }

  getUpdates(): UpdateEntry[] {
    return this.readJson<UpdateEntry[]>('updates.json', []).sort(
      (a, b) => b.discoveredAt - a.discoveredAt,
    );
  }

  clearUpdates(): UpdateEntry[] {
    this.writeJson('updates.json', []);
    return [];
  }

  async checkLibraryUpdates(engineUrl: string): Promise<{
    updates: UpdateEntry[];
    library: LibraryEntry[];
    newCount: number;
    failedKeys: string[];
    okKeys: string[];
  }> {
    const snapshotLib = this.getLibrary();
    const targets = snapshotLib.filter((e) => {
      const src = String(e.manga.source ?? '');
      return src && src !== 'LOCAL';
    });

    const verifiedSet = new Set<string>();
    try {
      const sRes = await fetch(`${engineUrl}/api/sources?includeUnverified=false`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (sRes.ok) {
        const sData = (await sRes.json()) as { sources?: Array<{ name?: string }> };
        for (const s of sData.sources ?? []) {
          if (s.name) verifiedSet.add(s.name);
        }
      }
    } catch {
      // Fallback: inspect targets without pre-filter
    }

    const checkedMap = new Map<
      string,
      | {
          ok: true;
          manga: Record<string, unknown>;
          knownChapterIds: string[];
          totalChapters: number;
          unreadCount: number;
          updates: UpdateEntry[];
        }
      | { ok: false }
    >();

    const liveTargets: LibraryEntry[] = [];
    for (const entry of targets) {
      const src = String(entry.manga.source ?? '');
      if (KNOWN_DEAD_SOURCES.has(src) || (verifiedSet.size > 0 && !verifiedSet.has(src))) {
        checkedMap.set(entry.key, { ok: false });
      } else {
        liveTargets.push(entry);
      }
    }

    const batchSize = 6;
    for (let i = 0; i < liveTargets.length; i += batchSize) {
      const slice = liveTargets.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (entry) => {
          try {
            const src = String(entry.manga.source);
            const res = await fetch(`${engineUrl}/api/sources/${encodeURIComponent(src)}/details`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ manga: entry.manga }),
              signal: AbortSignal.timeout(15_000),
            });
            if (!res.ok) {
              checkedMap.set(entry.key, { ok: false });
              return;
            }
            const data = (await res.json()) as { manga: Record<string, unknown> };
            const fullManga = data.manga;
            const chapters = Array.isArray(fullManga?.chapters)
              ? (fullManga.chapters as Array<Record<string, unknown>>)
              : [];
            if (!fullManga || chapters.length === 0) {
              checkedMap.set(entry.key, { ok: false });
              return;
            }
            if (!fullManga.coverUrl && entry.manga.coverUrl) fullManga.coverUrl = entry.manga.coverUrl;
            if (!fullManga.largeCoverUrl && entry.manga.largeCoverUrl) {
              fullManga.largeCoverUrl = entry.manga.largeCoverUrl;
            }
            const chapterIds = chapters.map((c) => String(c.id));
            const prevKnown = new Set(entry.knownChapterIds ?? []);
            const readSet = new Set(entry.readChapterIds ?? []);
            const perMangaUpdates: UpdateEntry[] = [];

            if (prevKnown.size > 0) {
              for (const ch of chapters) {
                const chId = String(ch.id);
                if (!prevKnown.has(chId) && !readSet.has(chId)) {
                  perMangaUpdates.push({
                    id: `${entry.key}::${chId}`,
                    mangaKey: entry.key,
                    manga: fullManga,
                    chapter: ch,
                    discoveredAt: Date.now(),
                  });
                }
              }
            }

            const unreadCount = chapters.filter((c) => !readSet.has(String(c.id))).length;
            checkedMap.set(entry.key, {
              ok: true,
              manga: fullManga,
              knownChapterIds: chapterIds,
              totalChapters: chapters.length,
              unreadCount: prevKnown.size > 0 ? unreadCount : entry.unreadCount ?? 0,
              updates: perMangaUpdates,
            });
          } catch {
            checkedMap.set(entry.key, { ok: false });
          }
        }),
      );
    }

    // Re-read CURRENT library so migrations made while checking updates are never overwritten
    const currentLib = this.getLibrary();
    const existingUpdates = this.getUpdates();
    const seenUpdateIds = new Set(existingUpdates.map((u) => u.id));
    const newlyFound: UpdateEntry[] = [];
    const failedKeys: string[] = [];
    const okKeys: string[] = [];
    const now = Date.now();

    for (const entry of currentLib) {
      const res = checkedMap.get(entry.key);
      if (!res) continue;
      if (!res.ok) {
        failedKeys.push(entry.key);
        continue;
      }
      okKeys.push(entry.key);
      entry.manga = res.manga;
      entry.knownChapterIds = res.knownChapterIds;
      entry.totalChapters = res.totalChapters;
      entry.unreadCount = res.unreadCount;
      entry.lastCheckedAt = now;
      for (const u of res.updates) {
        if (!seenUpdateIds.has(u.id)) {
          seenUpdateIds.add(u.id);
          newlyFound.push(u);
        }
      }
    }

    this.writeJson('library.json', currentLib);
    const mergedUpdates = [...newlyFound, ...existingUpdates].slice(0, 300);
    this.writeJson('updates.json', mergedUpdates);
    return {
      updates: mergedUpdates,
      library: currentLib,
      newCount: newlyFound.length,
      failedKeys,
      okKeys,
    };
  }

  getStats(): ReadingStats {
    return { ...DEFAULT_STATS, ...this.readJson<Partial<ReadingStats>>('stats.json', {}) };
  }

  recordStats(payload: {
    pagesDelta?: number;
    chapterCompleted?: boolean;
    minutesDelta?: number;
    tags?: string[];
  }): ReadingStats {
    const stats = this.getStats();
    stats.pagesRead += payload.pagesDelta ?? 0;
    if (payload.chapterCompleted) stats.chaptersCompleted += 1;
    stats.readingMinutes += payload.minutesDelta ?? 0;
    const today = new Date().toISOString().slice(0, 10);
    if (!stats.activeDays.includes(today)) {
      stats.activeDays = [...stats.activeDays, today].slice(-365);
    }
    if (payload.chapterCompleted && payload.tags?.length) {
      for (const tag of payload.tags) {
        stats.genreCounts[tag] = (stats.genreCounts[tag] ?? 0) + 1;
      }
    }
    this.writeJson('stats.json', stats);
    return stats;
  }

  getHistory(): HistoryEntry[] {
    return this.readJson<HistoryEntry[]>('history.json', []).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  upsertHistory(entry: HistoryEntry): HistoryEntry[] {
    const list = this.getHistory().filter((x) => x.key !== entry.key);
    list.unshift(entry);
    const trimmed = list.slice(0, 200);
    this.writeJson('history.json', trimmed);
    return trimmed;
  }

  removeHistory(key: string): HistoryEntry[] {
    const list = this.getHistory().filter((x) => x.key !== key);
    this.writeJson('history.json', list);
    return list;
  }

  getSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...this.readJson<Partial<AppSettings>>('settings.json', {}) };
  }

  saveSettings(patch: Partial<AppSettings>): AppSettings {
    const next = { ...this.getSettings(), ...patch };
    this.writeJson('settings.json', next);
    return next;
  }

  getHomeCache(): Record<string, unknown> | null {
    return this.readJson<Record<string, unknown> | null>('home-cache.json', null);
  }

  saveHomeCache(snapshot: Record<string, unknown>): void {
    this.writeJson('home-cache.json', snapshot);
  }

  getDownloads(): DownloadedChapter[] {
    return this.readJson<DownloadedChapter[]>('downloads.json', []).filter((d) =>
      fs.existsSync(d.cbzPath),
    );
  }

  saveDownloads(list: DownloadedChapter[]): DownloadedChapter[] {
    this.writeJson('downloads.json', list);
    return list;
  }

  async downloadChapter(
    engineUrl: string,
    payload: {
      source: string;
      mangaId: string;
      mangaTitle: string;
      coverUrl?: string;
      chapter: Record<string, unknown>;
    },
    onProgress?: (done: number, total: number) => void,
  ): Promise<DownloadedChapter> {
    const chapterId = String(payload.chapter.id);
    const chapterNumber = Number(payload.chapter.number ?? 0);
    const chapterTitle = String(payload.chapter.title ?? `Chapter ${chapterNumber || ''}`);

    const pagesResp = await fetch(
      `${engineUrl}/api/sources/${encodeURIComponent(payload.source)}/pages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter: payload.chapter }),
      },
    );
    if (!pagesResp.ok) {
      throw new Error(`Failed to fetch pages (${pagesResp.status})`);
    }
    const { pages } = (await pagesResp.json()) as {
      pages: Array<{ url: string; resolvedUrl?: string }>;
    };

    const zip = new AdmZip();
    let done = 0;
    const total = pages.length;

    const fetchPage = async (idx: number) => {
      const p = pages[idx];
      const target = p.resolvedUrl || p.url;
      const imgUrl = `${engineUrl}/api/image?source=${encodeURIComponent(payload.source)}&url=${encodeURIComponent(target)}`;
      const res = await fetch(imgUrl);
      if (!res.ok) throw new Error(`Page ${idx + 1} failed (${res.status})`);
      const arrBuf = await res.arrayBuffer();
      const ct = res.headers.get('content-type') || '';
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
      const name = `${String(idx + 1).padStart(4, '0')}.${ext}`;
      zip.addFile(name, Buffer.from(arrBuf));
      done += 1;
      onProgress?.(done, total);
    };

    const concurrency = 4;
    for (let i = 0; i < pages.length; i += concurrency) {
      const slice = [];
      for (let j = i; j < Math.min(i + concurrency, pages.length); j++) {
        slice.push(fetchPage(j));
      }
      await Promise.all(slice);
    }

    const safeDir = path.join(
      this.downloadsDir,
      payload.source.replace(/[^a-zA-Z0-9_-]/g, '_'),
      payload.mangaId.replace(/[^a-zA-Z0-9_-]/g, '_'),
    );
    fs.mkdirSync(safeDir, { recursive: true });
    const cbzPath = path.join(safeDir, `${chapterId.replace(/[^a-zA-Z0-9_-]/g, '_')}.cbz`);
    zip.writeZip(cbzPath);
    const stat = fs.statSync(cbzPath);

    const record: DownloadedChapter = {
      key: `${payload.source}::${payload.mangaId}::${chapterId}`,
      source: payload.source,
      mangaId: payload.mangaId,
      mangaTitle: payload.mangaTitle,
      coverUrl: payload.coverUrl,
      chapterId,
      chapterNumber,
      chapterTitle,
      cbzPath,
      pageCount: total,
      sizeBytes: stat.size,
      downloadedAt: Date.now(),
    };

    const existing = this.getDownloads().filter((d) => d.key !== record.key);
    existing.unshift(record);
    this.saveDownloads(existing);
    return record;
  }

  deleteDownload(key: string): DownloadedChapter[] {
    const list = this.getDownloads();
    const target = list.find((d) => d.key === key);
    if (target && fs.existsSync(target.cbzPath)) {
      try {
        fs.unlinkSync(target.cbzPath);
      } catch {
        // Ignore
      }
    }
    const next = list.filter((d) => d.key !== key);
    return this.saveDownloads(next);
  }

  listCbzEntries(cbzPath: string): string[] {
    if (cbzPath.startsWith('folder://')) {
      const dir = cbzPath.slice('folder://'.length);
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    const zip = new AdmZip(cbzPath);
    return zip
      .getEntries()
      .filter((e) => !e.isDirectory && IMAGE_EXTS.has(path.extname(e.entryName).toLowerCase()))
      .map((e) => e.entryName)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  readCbzEntry(cbzPath: string, entryName: string): { buffer: Buffer; mime: string } | null {
    if (!fs.existsSync(cbzPath)) return null;
    const zip = new AdmZip(cbzPath);
    const entry = zip.getEntry(entryName);
    if (!entry) return null;
    return { buffer: entry.getData(), mime: mimeForExt(path.extname(entryName)) };
  }

  readFolderFile(folderPath: string, fileName: string): { buffer: Buffer; mime: string } | null {
    const full = path.join(folderPath, path.basename(fileName));
    if (!fs.existsSync(full)) return null;
    return { buffer: fs.readFileSync(full), mime: mimeForExt(path.extname(full)) };
  }

  importLocalArchive(filePath: string): LibraryEntry {
    const baseName = path.basename(filePath, path.extname(filePath));
    const entries = this.listCbzEntries(filePath);
    const id = String(Math.abs(hashString(filePath)));
    const key = `LOCAL::${id}`;
    const coverEntry = entries[0];
    const coverUrl = coverEntry
      ? `noctis-cbz://archive?path=${encodeURIComponent(filePath)}&entry=${encodeURIComponent(coverEntry)}`
      : undefined;

    const manga: Record<string, unknown> = {
      id,
      title: baseName,
      altTitles: [],
      url: filePath,
      publicUrl: filePath,
      rating: -1,
      contentRating: null,
      coverUrl: coverUrl ?? null,
      largeCoverUrl: coverUrl ?? null,
      state: 'FINISHED',
      authors: ['Local Archive'],
      description: `Imported local CBZ/ZIP archive (${entries.length} pages).`,
      source: 'LOCAL',
      tags: [{ title: 'Local', key: 'local', source: 'LOCAL' }],
      chapters: [
        {
          id: '1',
          title: baseName,
          number: 1,
          volume: 0,
          url: filePath,
          scanlator: 'Local File',
          uploadDate: fs.statSync(filePath).mtimeMs,
          branch: null,
          source: 'LOCAL',
        },
      ],
    };

    const entry: LibraryEntry = {
      key,
      manga,
      categoryIds: ['reading'],
      addedAt: Date.now(),
      totalChapters: 1,
    };
    this.upsertLibraryEntry(entry);
    return entry;
  }

  importLocalFolder(dirPath: string): LibraryEntry {
    const baseName = path.basename(dirPath);
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const directImages = items
      .filter((d) => d.isFile() && IMAGE_EXTS.has(path.extname(d.name).toLowerCase()))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const subDirs = items
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const chapters: Array<Record<string, unknown>> = [];
    let coverUrl: string | null = null;

    if (directImages.length > 0) {
      coverUrl = `noctis-cbz://folder?path=${encodeURIComponent(dirPath)}&file=${encodeURIComponent(directImages[0])}`;
      chapters.push({
        id: '1',
        title: baseName,
        number: 1,
        volume: 0,
        url: `folder://${dirPath}`,
        scanlator: 'Local Folder',
        uploadDate: fs.statSync(dirPath).mtimeMs,
        branch: null,
        source: 'LOCAL',
      });
    } else {
      subDirs.forEach((sub, idx) => {
        const subFull = path.join(dirPath, sub);
        const imgs = fs
          .readdirSync(subFull)
          .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (imgs.length > 0) {
          if (!coverUrl) {
            coverUrl = `noctis-cbz://folder?path=${encodeURIComponent(subFull)}&file=${encodeURIComponent(imgs[0])}`;
          }
          const numMatch = sub.match(/(\d+(?:\.\d+)?)/);
          chapters.push({
            id: String(idx + 1),
            title: sub,
            number: numMatch ? parseFloat(numMatch[1]) : idx + 1,
            volume: 0,
            url: `folder://${subFull}`,
            scanlator: 'Local Folder',
            uploadDate: fs.statSync(subFull).mtimeMs,
            branch: null,
            source: 'LOCAL',
          });
        }
      });
    }

    const id = String(Math.abs(hashString(dirPath)));
    const key = `LOCAL::${id}`;
    const manga: Record<string, unknown> = {
      id,
      title: baseName,
      altTitles: [],
      url: `folder://${dirPath}`,
      publicUrl: dirPath,
      rating: -1,
      contentRating: null,
      coverUrl,
      largeCoverUrl: coverUrl,
      state: 'FINISHED',
      authors: ['Local Folder'],
      description: `Imported local folder (${chapters.length} chapter${chapters.length === 1 ? '' : 's'}).`,
      source: 'LOCAL',
      tags: [{ title: 'Local', key: 'local', source: 'LOCAL' }],
      chapters,
    };

    const entry: LibraryEntry = {
      key,
      manga,
      categoryIds: ['reading'],
      addedAt: Date.now(),
      totalChapters: chapters.length,
    };
    this.upsertLibraryEntry(entry);
    return entry;
  }

  importLocalPaths(paths: string[]): LibraryEntry[] {
    const out: LibraryEntry[] = [];
    for (const p of paths) {
      if (!fs.existsSync(p)) continue;
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        out.push(this.importLocalFolder(p));
      } else if (['.cbz', '.zip'].includes(path.extname(p).toLowerCase())) {
        out.push(this.importLocalArchive(p));
      }
    }
    return out;
  }

  exportBackup(): Record<string, unknown> {
    return {
      version: 2,
      exportedAt: Date.now(),
      categories: this.getCategories(),
      library: this.getLibrary(),
      history: this.getHistory(),
      settings: this.getSettings(),
      stats: this.getStats(),
    };
  }

  importBackup(data: Record<string, unknown>): void {
    if (Array.isArray(data.categories)) this.saveCategories(data.categories as Category[]);
    if (Array.isArray(data.library)) this.writeJson('library.json', data.library);
    if (Array.isArray(data.history)) this.writeJson('history.json', data.history);
    if (data.settings && typeof data.settings === 'object') {
      this.saveSettings(data.settings as Partial<AppSettings>);
    }
    if (data.stats && typeof data.stats === 'object') {
      this.writeJson('stats.json', data.stats);
    }
  }
}

function mimeForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return h;
}

export const storageManager = new StorageManager();
