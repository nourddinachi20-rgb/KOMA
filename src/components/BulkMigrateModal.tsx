import { useEffect, useMemo, useRef, useState } from 'react';
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
import { CustomSelect } from './CustomSelect';
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

function tokenizeTitle(raw: string): string[] {
  return raw
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]+/)
    .filter((w) => w.length >= 2);
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
    if (t.length < 4) continue;
    const partial = candidates.find((c) => {
      const cn = normalizeMatchTitle(c.title);
      return cn.length >= 4 && (cn.includes(t) || t.includes(cn));
    });
    if (partial) return partial;
  }

  // Fallback word-overlap scoring (prevents unrelated trending hits on non-filtering sources)
  const targetTokens = Array.from(
    new Set([entry.manga.title, ...(entry.manga.altTitles ?? [])].flatMap(tokenizeTitle)),
  );
  if (targetTokens.length === 0) return null;

  let bestScore = 0;
  let bestCandidate: Manga | null = null;
  for (const c of candidates) {
    const candTokens = new Set(tokenizeTitle(c.title));
    if (candTokens.size === 0) continue;
    let hits = 0;
    for (const w of targetTokens) {
      if (candTokens.has(w)) hits++;
    }
    const score = hits / Math.max(1, Math.min(targetTokens.length, candTokens.size));
    if (score >= 0.5 && score > bestScore) {
      bestScore = score;
      bestCandidate = c;
    }
  }
  return bestCandidate;
}

function buildSearchQueries(entry: LibraryEntry): string[] {
  const cleaned = entry.manga.title
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\s*[:\-–—]\s*(official|colored|digital).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const baseSegment = cleaned.split(/[:\-–—/|,!?]/)[0]?.trim() || '';
  const words = cleaned.split(/\s+/).filter(Boolean);
  const shortCore = words.length >= 4 ? words.slice(0, 3).join(' ') : '';
  const rawList = [
    entry.manga.title.trim(),
    cleaned,
    baseSegment,
    shortCore,
    ...(entry.manga.altTitles ?? []).map((s) => s.trim()),
  ];
  const unique: string[] = [];
  for (const q of rawList) {
    if (q && !unique.some((u) => u.toLowerCase() === q.toLowerCase())) {
      unique.push(q);
    }
    if (unique.length >= 4) break;
  }
  return unique;
}

export function BulkMigrateModal({ open, entries, onClose }: BulkMigrateModalProps) {
  const { engineStatus, sources, settings, migrateLibraryBatch, syncPushNow, syncSession, notify } =
    useAppStore();

  const [sessionEntries, setSessionEntries] = useState<LibraryEntry[]>([]);
  const [targetMode, setTargetMode] = useState<string>('AUTO');
  const [fallbackToAuto, setFallbackToAuto] = useState<boolean>(true);
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [rowStatus, setRowStatus] = useState<Record<string, RowProgress>>({});
  const [manualEntry, setManualEntry] = useState<LibraryEntry | null>(null);

  const stopRef = useRef(false);
  const pendingCommitRef = useRef<Array<{ oldKey: string; newManga: Manga }>>([]);
  const flushChainRef = useRef<Promise<void>>(Promise.resolve());

  // Snapshot entries cleanly on open so mid-run commits never shift visible rows/indices
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSessionEntries(entries);
      setRowStatus({});
      setDoneCount(0);
    }
    wasOpenRef.current = open;
  }, [open, entries]);

  const flushBatch = (force = false): Promise<void> => {
    if (pendingCommitRef.current.length === 0) return flushChainRef.current;
    if (!force && pendingCommitRef.current.length < 10) return flushChainRef.current;
    const next = flushChainRef.current.then(async () => {
      const batch = pendingCommitRef.current.splice(0, pendingCommitRef.current.length);
      if (batch.length > 0) {
        await migrateLibraryBatch(batch);
      }
    });
    flushChainRef.current = next.catch((err) => {
      notify(err instanceof Error ? err.message : 'Failed to save migrated batch', 'error');
    });
    return next;
  };

  // Only list healthy non-broken sources so migrated titles never end up broken again
  const sortedSources = useMemo(
    () =>
      sources
        .filter((s) => !s.isBroken)
        .sort((a, b) => {
          const aPin = settings.pinnedSources.includes(a.name) ? 0 : 1;
          const bPin = settings.pinnedSources.includes(b.name) ? 0 : 1;
          if (aPin !== bPin) return aPin - bPin;
          return a.title.localeCompare(b.title);
        }),
    [sources, settings.pinnedSources],
  );

  const autoTargetPool = useMemo(() => {
    const pinned = settings.pinnedSources.filter((name) =>
      sortedSources.some((s) => s.name === name),
    );
    const sameLang = sortedSources
      .filter((s) => settings.preferredLanguages.includes(s.locale) || s.locale === '')
      .map((s) => s.name);
    const rest = sortedSources.map((s) => s.name);
    return Array.from(new Set([...pinned, ...sameLang, ...rest])).slice(0, 14);
  }, [sortedSources, settings.pinnedSources, settings.preferredLanguages]);

  const sourceOrderFor = (srcName: string) => {
    const orders = sources.find((s) => s.name === srcName)?.sortOrders;
    if (orders?.includes('RELEVANCE')) return 'RELEVANCE' as const;
    if (orders?.includes('POPULARITY')) return 'POPULARITY' as const;
    return orders?.[0];
  };

  const searchOneSource = async (
    entry: LibraryEntry,
    engineUrl: string,
    srcName: string,
    queries: string[],
  ): Promise<Manga | null> => {
    const order = sourceOrderFor(srcName);
    for (const q of queries) {
      if (stopRef.current) return null;
      const items = await fetchMangaList(engineUrl, srcName, {
        query: q,
        order,
        skipCfChallenge: true,
      }).catch(() => []);
      const best = pickBestCandidate(entry, items);
      if (best) {
        const full = await fetchMangaDetails(engineUrl, best).catch(() => null);
        if (full) {
          return {
            ...best,
            ...full,
            coverUrl:
              full.coverUrl ||
              best.coverUrl ||
              entry.manga.coverUrl ||
              entry.manga.largeCoverUrl ||
              null,
            largeCoverUrl:
              full.largeCoverUrl ||
              best.largeCoverUrl ||
              entry.manga.largeCoverUrl ||
              entry.manga.coverUrl ||
              null,
          };
        }
        return {
          ...best,
          coverUrl: best.coverUrl || entry.manga.coverUrl || entry.manga.largeCoverUrl || null,
          largeCoverUrl:
            best.largeCoverUrl || entry.manga.largeCoverUrl || entry.manga.coverUrl || null,
        };
      }
    }
    return null;
  };

  const migrateSingleEntry = async (entry: LibraryEntry, engineUrl: string): Promise<boolean> => {
    setRowStatus((prev) => ({
      ...prev,
      [entry.key]: { status: 'searching', message: 'Searching...' },
    }));

    try {
      const baseQueries = buildSearchQueries(entry);
      const runPool = async (queries: string[], candidateEntry: LibraryEntry): Promise<Manga | null> => {
        let hit: Manga | null = null;
        if (targetMode !== 'AUTO') {
          hit = await searchOneSource(candidateEntry, engineUrl, targetMode, queries);
        }
        if (!hit && (targetMode === 'AUTO' || fallbackToAuto)) {
          const pool = autoTargetPool.filter(
            (s) => s !== candidateEntry.manga.source && s !== targetMode,
          );
          for (const srcName of pool) {
            if (stopRef.current) break;
            const candidate = await searchOneSource(candidateEntry, engineUrl, srcName, queries);
            if (candidate && candidate.chapters && candidate.chapters.length > 0) {
              return candidate;
            }
            if (!hit && candidate) hit = candidate;
          }
        }
        return hit;
      };

      let matchedFull = await runPool(baseQueries, entry);

      // If no match yet (common for imported backups that only have Romaji OR English title), look up AniList aliases cleanly
      if (!matchedFull && !stopRef.current) {
        const meta = await window.noctis
          .fetchAniListMetadata(entry.manga.title, entry.manga.altTitles?.[0])
          .catch(() => null);
        const extraNames = [meta?.title]
          .map((x) => (x ?? '').trim())
          .filter(
            (x) =>
              x.length >= 2 &&
              !baseQueries.some((q) => q.toLowerCase() === x.toLowerCase()),
          );
        if (extraNames.length > 0) {
          const enrichedEntry: LibraryEntry = {
            ...entry,
            manga: {
              ...entry.manga,
              altTitles: Array.from(new Set([...(entry.manga.altTitles ?? []), ...extraNames])),
            },
          };
          matchedFull = await runPool(extraNames, enrichedEntry);
        }
      }

      if (matchedFull && !stopRef.current) {
        pendingCommitRef.current.push({ oldKey: entry.key, newManga: matchedFull });
        await flushBatch(false);
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

  const pushIfSignedIn = () => {
    if (syncSession) {
      void syncPushNow(true).catch(() => {});
    }
  };

  const handleCloseSafely = async () => {
    stopRef.current = true;
    await flushBatch(true);
    pushIfSignedIn();
    setRunning(false);
    onClose();
  };

  const handleStartAll = async () => {
    if (running || !engineStatus.ready || !engineStatus.url || sessionEntries.length === 0) return;
    stopRef.current = false;
    setRunning(true);
    setDoneCount(0);

    const queue = sessionEntries.filter((e) => rowStatus[e.key]?.status !== 'done');
    const engineUrl = engineStatus.url;
    let migratedCount = 0;
    let failedCount = 0;
    let cursor = 0;
    const workerCount = Math.min(3, queue.length);

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
    await flushBatch(true);
    pushIfSignedIn();

    setRunning(false);
    if (!stopRef.current) {
      notify(
        `Migrated ${migratedCount} manga${failedCount > 0 ? ` · ${failedCount} unmatched` : ''}`,
        migratedCount > 0 ? 'success' : 'info',
      );
    }
  };

  const pendingEntries = sessionEntries.filter((e) => rowStatus[e.key]?.status !== 'done');
  const displayEntries = useMemo(() => {
    const rank = (k: string) => {
      const s = rowStatus[k]?.status;
      if (s === 'failed') return 0;
      if (s === 'searching') return 1;
      if (!s || s === 'pending') return 2;
      return 3;
    };
    return [...sessionEntries].sort((a, b) => rank(a.key) - rank(b.key));
  }, [sessionEntries, rowStatus]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!running) void handleCloseSafely();
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
                    {sessionEntries.length} manga ·{' '}
                    {running
                      ? `${doneCount} / ${sessionEntries.length} processed`
                      : 'Commits atomically across working sources'}
                  </p>
                </div>
                <button
                  onClick={() => void handleCloseSafely()}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-zinc-300">Destination Source</span>
                  <CustomSelect
                    value={targetMode}
                    disabled={running}
                    onChange={setTargetMode}
                    className="max-w-[260px]"
                    options={[
                      { value: 'AUTO', label: 'Auto (Fast Working Sources)' },
                      ...sortedSources.map((s) => ({
                        value: s.name,
                        label: `${s.title} (${s.locale ? s.locale.toUpperCase() : 'MULTI'})`,
                      })),
                    ]}
                  />
                </div>
                {targetMode !== 'AUTO' && (
                  <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 cursor-pointer">
                    <span>Auto-fallback to working sources if not on chosen source</span>
                    <input
                      type="checkbox"
                      checked={fallbackToAuto}
                      disabled={running}
                      onChange={(e) => setFallbackToAuto(e.target.checked)}
                      className="h-3.5 w-3.5 accent-white cursor-pointer"
                    />
                  </label>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-5">
                {displayEntries.map((entry) => {
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
                          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Searching</span>
                          </span>
                        )}
                        {st?.status === 'done' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] leading-none text-emerald-300">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            <span>{st.message}</span>
                          </span>
                        )}
                        {st?.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => setManualEntry(entry)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/[0.08] px-2.5 py-1.5 text-[11px] leading-none text-white hover:bg-white/15 cursor-pointer"
                          >
                            <Search className="h-3 w-3 shrink-0" />
                            <span>Pick</span>
                          </button>
                        )}
                        {!st && (
                          <button
                            type="button"
                            onClick={() => setManualEntry(entry)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] leading-none text-zinc-400 hover:border-white/25 hover:text-white cursor-pointer"
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0 text-rose-400" />
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
                  onClick={() => void handleCloseSafely()}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-xs leading-none text-zinc-300 hover:text-white cursor-pointer"
                >
                  {running ? 'Stop & Save' : 'Close'}
                </button>

                <button
                  type="button"
                  disabled={running || pendingEntries.length === 0 || !engineStatus.ready}
                  onClick={() => void handleStartAll()}
                  className="accent-bg inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-xs font-semibold leading-none disabled:opacity-40 cursor-pointer"
                >
                  {running ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {running
                      ? `Migrating ${doneCount}/${sessionEntries.length}...`
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
            const stillPresent = useAppStore
              .getState()
              .library.some((x) => x.key === manualEntry.key);
            if (!stillPresent) {
              setRowStatus((prev) => ({
                ...prev,
                [manualEntry.key]: { status: 'done', message: 'Migrated' },
              }));
              pushIfSignedIn();
            }
            setManualEntry(null);
          }}
        />
      )}
    </>
  );
}
