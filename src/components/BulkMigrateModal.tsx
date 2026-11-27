import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { LibraryEntry, Manga } from '../types';
import { fetchMangaDetails, fetchMangaList } from '../utils/api';
import { MigrateModal } from './MigrateModal';

interface BulkMigrateModalProps {
  open: boolean;
  entries: LibraryEntry[];
  onClose: () => void;
}

type RowState = 'pending' | 'searching' | 'done' | 'failed';

interface RowProgress {
  status: RowState;
  message?: string;
}

function normalizeMatchTitle(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]+/g, '');
}

function pickBestCandidate(entry: LibraryEntry, candidates: Manga[]): Manga | null {
  if (candidates.length === 0) return null;
  const targets = [entry.manga.title, ...(entry.manga.altTitles ?? [])]
    .map(normalizeMatchTitle)
    .filter(Boolean);

  for (const t of targets) {
    const exact = candidates.find((c) => normalizeMatchTitle(c.title) === t);
    if (exact) return exact;
  }
  for (const t of targets) {
    const partial = candidates.find((c) => {
      const cn = normalizeMatchTitle(c.title);
      return cn.includes(t) || t.includes(cn);
    });
    if (partial) return partial;
  }
  return candidates[0];
}

export function BulkMigrateModal({ open, entries, onClose }: BulkMigrateModalProps) {
  const { engineStatus, sources, settings, migrateLibraryManga, notify } = useAppStore();

  const [targetMode, setTargetMode] = useState<string>('AUTO');
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [rowStatus, setRowStatus] = useState<Record<string, RowProgress>>({});
  const [manualEntry, setManualEntry] = useState<LibraryEntry | null>(null);
  const stopRef = useRef(false);

  const sortedSources = useMemo(
    () =>
      [...sources].sort((a, b) => {
        const aPin = settings.pinnedSources.includes(a.name) ? 0 : 1;
        const bPin = settings.pinnedSources.includes(b.name) ? 0 : 1;
        if (aPin !== bPin) return aPin - bPin;
        return a.title.localeCompare(b.title);
      }),
    [sources, settings.pinnedSources],
  );

  const autoTargetPool = useMemo(() => {
    const pinned = settings.pinnedSources.filter((name) =>
      sources.some((s) => s.name === name && !s.isBroken),
    );
    const extra = sources
      .filter((s) => !s.isBroken && (s.locale === 'en' || s.locale === ''))
      .slice(0, 6)
      .map((s) => s.name);
    return Array.from(new Set([...pinned, ...extra])).slice(0, 6);
  }, [sources, settings.pinnedSources]);

  const migrateSingleEntry = async (entry: LibraryEntry, engineUrl: string): Promise<boolean> => {
    setRowStatus((prev) => ({
      ...prev,
      [entry.key]: { status: 'searching', message: 'Searching...' },
    }));

    try {
      let matchedFull: Manga | null = null;

      if (targetMode === 'AUTO') {
        const pool = autoTargetPool.filter((s) => s !== entry.manga.source);
        // Sequential wave over top fast working sources with early short-circuit (avoids waiting on 8 slow sources)
        for (const srcName of pool) {
          if (stopRef.current) break;
          const items = await fetchMangaList(engineUrl, srcName, {
            query: entry.manga.title,
          }).catch(() => []);
          const best = pickBestCandidate(entry, items);
          if (!best) continue;
          const full = await fetchMangaDetails(engineUrl, best).catch(() => null);
          if (full && full.chapters && full.chapters.length > 0) {
            matchedFull = full;
            break;
          }
          if (!matchedFull && full) matchedFull = full;
        }
      } else {
        const list = await fetchMangaList(engineUrl, targetMode, {
          query: entry.manga.title,
        }).catch(() => []);
        const best = pickBestCandidate(entry, list);
        if (best) {
          matchedFull = (await fetchMangaDetails(engineUrl, best).catch(() => null)) ?? best;
        }
      }

      if (matchedFull) {
        await migrateLibraryManga(entry.key, matchedFull);
        const srcLabel =
          sources.find((s) => s.name === matchedFull!.source)?.title ?? matchedFull.source;
        setRowStatus((prev) => ({
          ...prev,
          [entry.key]: {
            status: 'done',
            message: `${srcLabel}${matchedFull.chapters ? ` · ${matchedFull.chapters.length} ch` : ''}`,
          },
        }));
        return true;
      }

      setRowStatus((prev) => ({
        ...prev,
        [entry.key]: { status: 'failed', message: 'No match' },
      }));
      return false;
    } catch {
      setRowStatus((prev) => ({
        ...prev,
        [entry.key]: { status: 'failed', message: 'Error' },
      }));
      return false;
    }
  };

  const handleStartAll = async () => {
    if (running || !engineStatus.ready || !engineStatus.url || entries.length === 0) return;
    stopRef.current = false;
    setRunning(true);
    setDoneCount(0);

    const queue = entries.filter((e) => rowStatus[e.key]?.status !== 'done');
    const engineUrl = engineStatus.url;
    let migratedCount = 0;
    let failedCount = 0;
    let cursor = 0;
    const workerCount = Math.min(4, queue.length);

    const workers = Array.from({ length: workerCount }, async () => {
      while (!stopRef.current) {
        const idx = cursor++;
        if (idx >= queue.length) break;
        const ok = await migrateSingleEntry(queue[idx], engineUrl);
        if (ok) migratedCount++;
        else failedCount++;
        setDoneCount((d) => d + 1);
      }
    });

    await Promise.all(workers);

    setRunning(false);
    if (!stopRef.current) {
      notify(
        `Migrated ${migratedCount} manga${failedCount > 0 ? ` · ${failedCount} unmatched` : ''}`,
        migratedCount > 0 ? 'success' : 'info',
      );
    }
  };

  const pendingEntries = entries.filter((e) => rowStatus[e.key]?.status !== 'done');

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!running) onClose();
            }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-[#09090D] sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-white">Migrate Broken Sources</h2>
                  <p className="text-xs text-zinc-400">
                    {entries.length} manga · {running ? `${doneCount} / ${entries.length} processed` : '4x parallel search with progress kept'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    stopRef.current = true;
                    onClose();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="border-b border-white/[0.06] bg-white/[0.02] px-5 py-3">
                <label className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-zinc-300">Destination Source</span>
                  <select
                    value={targetMode}
                    disabled={running}
                    onChange={(e) => setTargetMode(e.target.value)}
                    className="max-w-[260px] rounded-full border border-white/15 bg-black px-3.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="AUTO">Auto (Fast Working Sources)</option>
                    {sortedSources.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.title} ({s.locale ? s.locale.toUpperCase() : 'MULTI'})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-5">
                {entries.map((entry) => {
                  const st = rowStatus[entry.key];
                  return (
                    <div
                      key={entry.key}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white">
                          {entry.manga.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                          <span className="truncate">
                            From: {entry.manga.source.replace(/_/g, ' ')}
                          </span>
                          {(entry.readChapterIds?.length ?? 0) > 0 && (
                            <span>· {entry.readChapterIds!.length} read</span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {st?.status === 'searching' && (
                          <span className="flex items-center gap-1 text-[11px] text-zinc-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Searching</span>
                          </span>
                        )}
                        {st?.status === 'done' && (
                          <span className="flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{st.message}</span>
                          </span>
                        )}
                        {st?.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => setManualEntry(entry)}
                            className="flex items-center gap-1 rounded-full border border-white/20 bg-white/[0.08] px-2.5 py-1 text-[11px] text-white hover:bg-white/15 cursor-pointer"
                          >
                            <Search className="h-3 w-3" />
                            <span>Pick</span>
                          </button>
                        )}
                        {!st && (
                          <button
                            type="button"
                            onClick={() => setManualEntry(entry)}
                            className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-white/25 hover:text-white cursor-pointer"
                          >
                            <AlertTriangle className="h-3 w-3 text-rose-400" />
                            <span>Fix</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] bg-black/50 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => {
                    stopRef.current = true;
                    setRunning(false);
                    onClose();
                  }}
                  className="rounded-full border border-white/15 px-4 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
                >
                  {running ? 'Stop & Close' : 'Close'}
                </button>

                <button
                  type="button"
                  disabled={running || pendingEntries.length === 0 || !engineStatus.ready}
                  onClick={() => void handleStartAll()}
                  className="accent-bg flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  {running ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {running
                      ? `Migrating ${doneCount}/${entries.length}...`
                      : `Migrate All (${pendingEntries.length})`}
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {manualEntry && (
        <MigrateModal
          open={Boolean(manualEntry)}
          manga={manualEntry.manga}
          onClose={() => {
            setRowStatus((prev) => ({
              ...prev,
              [manualEntry.key]: { status: 'done', message: 'Migrated' },
            }));
            setManualEntry(null);
          }}
        />
      )}
    </>
  );
}
