import type { HistoryEntry, LibraryEntry, ReadingStats } from '../types';

export interface EffectiveReadingStats {
  seriesRead: number;
  chaptersCompleted: number;
  pagesRead: number;
  readingMinutes: number;
  streakDays: number;
  totalActiveDays: number;
  topGenre: string | null;
  activeDays: string[];
  genreCounts: Record<string, number>;
}

const MIN_VALID_TS_MS = 946684800000; // 2000-01-01T00:00:00Z

function toIsoDay(ts: number | undefined): string | null {
  if (!ts || !Number.isFinite(ts) || ts < MIN_VALID_TS_MS) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

function normalizeSeriesKey(title: string | undefined, fallbackKey: string): string {
  const norm = (title ?? '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return norm || fallbackKey;
}

export function computeStreakDays(days: string[]): number {
  if (days.length === 0) return 0;
  const set = new Set(days);
  let streak = 0;
  const cur = new Date();
  while (true) {
    const iso = cur.toISOString().slice(0, 10);
    if (set.has(iso)) {
      streak += 1;
      cur.setDate(cur.getDate() - 1);
    } else if (streak === 0) {
      cur.setDate(cur.getDate() - 1);
      if (!set.has(cur.toISOString().slice(0, 10))) break;
    } else {
      break;
    }
  }
  return streak;
}

export function mergeReadingStats(
  localStats: ReadingStats | undefined,
  incomingStats: ReadingStats | undefined,
): ReadingStats {
  const a: ReadingStats = {
    chaptersCompleted: localStats?.chaptersCompleted ?? 0,
    pagesRead: localStats?.pagesRead ?? 0,
    readingMinutes: localStats?.readingMinutes ?? 0,
    activeDays: localStats?.activeDays ?? [],
    genreCounts: localStats?.genreCounts ?? {},
  };
  if (!incomingStats) return a;

  const genreCounts: Record<string, number> = { ...a.genreCounts };
  for (const [k, v] of Object.entries(incomingStats.genreCounts ?? {})) {
    genreCounts[k] = Math.max(genreCounts[k] ?? 0, v ?? 0);
  }

  return {
    chaptersCompleted: Math.max(a.chaptersCompleted, incomingStats.chaptersCompleted ?? 0),
    pagesRead: Math.max(a.pagesRead, incomingStats.pagesRead ?? 0),
    readingMinutes: Math.max(a.readingMinutes, incomingStats.readingMinutes ?? 0),
    activeDays: Array.from(new Set([...a.activeDays, ...(incomingStats.activeDays ?? [])]))
      .sort()
      .slice(-3650),
    genreCounts,
  };
}

/**
 * Combines live KOMA stats (`stats.json`) with imported library & history progress
 * (Kotatsu, Mihon, Komikku) without double-counting chapters or pages.
 */
export function computeEffectiveReadingStats(
  library: LibraryEntry[],
  history: HistoryEntry[],
  stats: ReadingStats,
): EffectiveReadingStats {
  const libByKey = new Map<string, LibraryEntry>();
  for (const entry of library) libByKey.set(entry.key, entry);

  const histByKey = new Map<string, HistoryEntry>();
  for (const h of history) histByKey.set(h.key, h);

  const allKeys = new Set<string>([...libByKey.keys(), ...histByKey.keys()]);
  const readSeriesSet = new Set<string>();
  const daySet = new Set<string>(stats.activeDays ?? []);
  const derivedGenres: Record<string, number> = {};

  let derivedChapters = 0;
  let extraCurrentPages = 0;

  for (const key of allKeys) {
    const lib = libByKey.get(key);
    const hist = histByKey.get(key);
    const manga = lib?.manga ?? hist?.manga;

    const explicitRead = lib?.readChapterIds?.length ?? 0;
    const importedRead = Math.max(0, Math.floor(hist?.importedChaptersRead ?? 0));
    const histChNum = hist && hist.chapterNumber > 0 ? Math.floor(hist.chapterNumber) : 0;
    const started =
      explicitRead > 0 ||
      importedRead > 0 ||
      hist != null ||
      (lib?.lastReadAt ?? 0) > 0;

    let entryChapters = 0;
    if (explicitRead > 0) {
      entryChapters = explicitRead;
    } else if (importedRead > 0) {
      entryChapters = importedRead;
    } else if (histChNum > 0) {
      entryChapters = histChNum;
    } else if (started) {
      entryChapters = 1;
    }

    if (started && manga) {
      readSeriesSet.add(normalizeSeriesKey(manga.title, key));
    }

    derivedChapters += entryChapters;
    if (entryChapters === 0 && hist && hist.pageIndex > 0) {
      extraCurrentPages += hist.pageIndex + 1;
    }

    const histDay = toIsoDay(hist?.updatedAt);
    if (histDay) daySet.add(histDay);
    const libDay = toIsoDay(lib?.lastReadAt);
    if (libDay) daySet.add(libDay);

    if (started && manga?.tags?.length) {
      const seenTags = new Set<string>();
      const weight = Math.max(1, entryChapters);
      for (const tag of manga.tags) {
        const cleanTag = tag.title?.trim();
        if (!cleanTag || seenTags.has(cleanTag)) continue;
        seenTags.add(cleanTag);
        derivedGenres[cleanTag] = (derivedGenres[cleanTag] ?? 0) + weight;
      }
    }
  }

  const storedChapters = Math.max(0, stats.chaptersCompleted ?? 0);
  const chaptersCompleted = Math.max(storedChapters, derivedChapters);
  const untrackedChapters = Math.max(0, chaptersCompleted - storedChapters);
  const pagesRead = (stats.pagesRead ?? 0) + untrackedChapters * 18 + extraCurrentPages;

  const mergedGenres: Record<string, number> = { ...(stats.genreCounts ?? {}) };
  for (const [tag, count] of Object.entries(derivedGenres)) {
    mergedGenres[tag] = Math.max(mergedGenres[tag] ?? 0, count);
  }

  let topGenre: string | null = null;
  let topGenreScore = 0;
  for (const [tag, count] of Object.entries(mergedGenres)) {
    if (count > topGenreScore) {
      topGenre = tag;
      topGenreScore = count;
    }
  }

  const activeDays = Array.from(daySet).sort();
  return {
    seriesRead: readSeriesSet.size,
    chaptersCompleted,
    pagesRead,
    readingMinutes: stats.readingMinutes ?? 0,
    streakDays: computeStreakDays(activeDays),
    totalActiveDays: activeDays.length,
    topGenre,
    activeDays,
    genreCounts: mergedGenres,
  };
}
