import type { MangaChapter } from '../types';

export type ChapterDupMode = 'dedupe' | 'collapse' | 'all';

function isBetterChapter(
  candidate: MangaChapter,
  current: MangaChapter,
  readIds?: Set<string>,
): boolean {
  const candDate = candidate.uploadDate || 0;
  const curDate = current.uploadDate || 0;
  if (candDate !== curDate) return candDate > curDate;

  // Prefer an exact whole number over .x only when dates match cleanly?
  // Wait: if dates match (e.g. 0), higher fractional (1.6 vs 1.2) is newer,
  // unless an already-read copy exists.
  if (candidate.number !== current.number) {
    return candidate.number > current.number;
  }

  const candRead = Boolean(readIds?.has(candidate.id));
  const curRead = Boolean(readIds?.has(current.id));
  if (candRead !== curRead) return candRead;

  return Boolean(candidate.title && !current.title);
}

/**
 * Collapses duplicate chapter uploads (or `.x` fractional sub-chapters when configured),
 * preserving only the latest version while keeping ascending chapter order.
 */
export function resolveCleanChapters(
  chapters: MangaChapter[],
  opts?: {
    mode?: ChapterDupMode;
    readIds?: Set<string>;
  },
): { chapters: MangaChapter[]; hiddenCount: number; hasFractional: boolean } {
  const mode = opts?.mode ?? 'dedupe';
  const readIds = opts?.readIds;

  let hasFractional = false;
  for (const c of chapters) {
    if (c.number >= 0 && Math.abs(c.number - Math.round(c.number)) > 1e-6) {
      hasFractional = true;
      break;
    }
  }

  if (mode === 'all' || chapters.length <= 1) {
    return { chapters, hiddenCount: 0, hasFractional };
  }

  const bestByKey = new Map<string, { chapter: MangaChapter; firstIdx: number }>();

  chapters.forEach((ch, idx) => {
    let groupKey: string;
    if (ch.number < 0 || Number.isNaN(ch.number)) {
      // Never collapse unnumbered/unknown chapters unless identical title & source
      groupKey = `unnumbered::${(ch.title ?? ch.id).trim().toLowerCase()}`;
    } else if (mode === 'collapse') {
      groupKey = `int::${Math.floor(ch.number + 1e-6)}`;
    } else {
      groupKey = `exact::${ch.number}`;
    }

    const existing = bestByKey.get(groupKey);
    if (!existing) {
      bestByKey.set(groupKey, { chapter: ch, firstIdx: idx });
    } else if (isBetterChapter(ch, existing.chapter, readIds)) {
      bestByKey.set(groupKey, { chapter: ch, firstIdx: existing.firstIdx });
    }
  });

  const clean = Array.from(bestByKey.values())
    .sort((a, b) => a.firstIdx - b.firstIdx)
    .map((x) => x.chapter);

  return {
    chapters: clean,
    hiddenCount: Math.max(0, chapters.length - clean.length),
    hasFractional,
  };
}
