import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Search, Sparkles, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Manga } from '../types';
import { getProxiedImageUrl, searchAcrossSources } from '../utils/api';

export function CommandPalette() {
  const {
    commandOpen,
    commandQuery,
    setCommandOpen,
    engineStatus,
    settings,
    sources,
    library,
    openManga,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [navigatedWithArrows, setNavigatedWithArrows] = useState(false);
  const [remoteGroups, setRemoteGroups] = useState<
    Array<{ source: string; sourceTitle: string; items: Manga[] }>
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeqRef = useRef(0);

  const runRemoteSearch = useCallback(
    async (rawQuery: string) => {
      const q = rawQuery.trim();
      if (!q || !engineStatus.ready || !engineStatus.url) {
        setRemoteGroups([]);
        return;
      }
      const seq = ++searchSeqRef.current;
      setLoading(true);
      try {
        const pinned = settings.pinnedSources.filter((name) =>
          sources.some((s) => s.name === name),
        );
        const fallback = sources
          .filter((s) => settings.preferredLanguages.includes(s.locale) || s.locale === '')
          .slice(0, 6)
          .map((s) => s.name);
        const targets = pinned.length > 0 ? pinned : fallback;
        const groups = await searchAcrossSources(engineStatus.url, q, targets);
        if (seq !== searchSeqRef.current) return;
        setRemoteGroups(groups.filter((g) => g.items.length > 0));
      } catch {
        if (seq === searchSeqRef.current) setRemoteGroups([]);
      } finally {
        if (seq === searchSeqRef.current) setLoading(false);
      }
    },
    [engineStatus.ready, engineStatus.url, settings.pinnedSources, settings.preferredLanguages, sources],
  );

  const localMatches = useMemo(
    () =>
      query.trim()
        ? library
            .filter((e) => e.manga.title.toLowerCase().includes(query.trim().toLowerCase()))
            .slice(0, 6)
        : [],
    [query, library],
  );

  const flatResults = useMemo(() => {
    const list: Manga[] = localMatches.map((e) => e.manga);
    for (const g of remoteGroups) {
      for (const item of g.items) list.push(item);
    }
    return list;
  }, [localMatches, remoteGroups]);

  useEffect(() => {
    setSelectedIdx(0);
    setNavigatedWithArrows(false);
  }, [flatResults.length, query]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(!commandOpen);
        return;
      }
      if (!commandOpen) return;

      if (e.key === 'Escape') {
        setCommandOpen(false);
      } else if (e.key === 'ArrowDown' && flatResults.length > 0) {
        e.preventDefault();
        setNavigatedWithArrows(true);
        setSelectedIdx((i) => (i + 1) % flatResults.length);
      } else if (e.key === 'ArrowUp' && flatResults.length > 0) {
        e.preventDefault();
        setNavigatedWithArrows(true);
        setSelectedIdx((i) => (i - 1 + flatResults.length) % flatResults.length);
      } else if (e.key === 'Enter' && navigatedWithArrows && flatResults.length > 0 && !loading) {
        const picked = flatResults[selectedIdx];
        if (picked) {
          e.preventDefault();
          setCommandOpen(false);
          openManga(picked);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandOpen, setCommandOpen, flatResults, selectedIdx, navigatedWithArrows, loading, openManga]);

  useEffect(() => {
    if (commandOpen) {
      if (commandQuery) {
        setQuery(commandQuery);
        void runRemoteSearch(commandQuery);
      }
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      searchSeqRef.current++;
      setQuery('');
      setRemoteGroups([]);
      setSelectedIdx(0);
    }
  }, [commandOpen, commandQuery, runRemoteSearch]);

  // Debounced live remote search as user types
  useEffect(() => {
    if (!commandOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      if (q.length === 0) setRemoteGroups([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void runRemoteSearch(q);
    }, 360);
    return () => window.clearTimeout(timer);
  }, [commandOpen, query, runRemoteSearch]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    void runRemoteSearch(query);
  };

  return (
    <AnimatePresence>
      {commandOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setCommandOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-[10vh] backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="oled-glass w-full max-w-3xl overflow-hidden rounded-2xl"
          >
            <form
              onSubmit={handleSearch}
              className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4"
            >
              <Search className="h-5 w-5 text-zinc-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across your library and pinned sources — press Enter"
                className="flex-1 bg-transparent text-[15px] text-white placeholder-zinc-500 focus:outline-none"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="rounded-md p-1 text-zinc-500 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40 cursor-pointer"
              >
                Search All
              </button>
            </form>

            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-5">
              {!query.trim() && remoteGroups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-500">
                  <Sparkles className="mb-2 h-6 w-6 text-zinc-600" />
                  <p className="text-sm text-zinc-400">
                    Multi-source instant search across {settings.pinnedSources.length} pinned sources
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Type a title and hit Enter to query MangaDex, Asura, MangaKatana, Comick, and more simultaneously.
                  </p>
                </div>
              )}

              {query.trim().length > 0 && localMatches.length === 0 && remoteGroups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
                  {loading || query.trim().length >= 2 ? (
                    <>
                      <Loader2 className="mb-2 h-5 w-5 animate-spin text-zinc-400" />
                      <p className="text-xs text-zinc-400">
                        {loading
                          ? 'Searching pinned sources...'
                          : 'Searching pinned sources or press Enter...'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-zinc-500">Keep typing to search all pinned sources...</p>
                  )}
                </div>
              )}

              {localMatches.length > 0 && (
                <div>
                  <h4 className="mb-2.5 px-1 font-mono-tech text-[10px] uppercase tracking-widest text-zinc-500">
                    In Your Library
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {localMatches.map((entry, idx) => {
                      const active = idx === selectedIdx;
                      return (
                        <button
                          key={entry.key}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          onClick={() => {
                            setCommandOpen(false);
                            openManga(entry.manga);
                          }}
                          className={`flex items-center gap-3 rounded-xl border p-2 text-left transition cursor-pointer ${
                            active
                              ? 'border-white/30 bg-white/[0.1]'
                              : 'border-white/[0.06] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]'
                          }`}
                        >
                          <img
                            src={getProxiedImageUrl(
                              engineStatus.url,
                              entry.manga.source,
                              entry.manga.coverUrl,
                            )}
                            alt={entry.manga.title}
                            className="h-14 w-10 rounded-lg object-cover bg-zinc-900"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-white">
                              {entry.manga.title}
                            </div>
                            <div className="mt-0.5 font-mono-tech text-[11px] text-zinc-400">
                              {entry.manga.source}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {remoteGroups.map((group, gIdx) => {
                const groupOffset =
                  localMatches.length +
                  remoteGroups.slice(0, gIdx).reduce((acc, g) => acc + g.items.length, 0);
                return (
                  <div key={group.source}>
                    <h4 className="mb-2.5 px-1 font-mono-tech text-[10px] uppercase tracking-widest text-zinc-500">
                      {group.sourceTitle} ({group.items.length})
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.items.map((item, itemIdx) => {
                        const flatIdx = groupOffset + itemIdx;
                        const active = flatIdx === selectedIdx;
                        return (
                          <button
                            key={`${group.source}-${item.id}`}
                            onMouseEnter={() => setSelectedIdx(flatIdx)}
                            onClick={() => {
                              setCommandOpen(false);
                              openManga(item);
                            }}
                            className={`flex items-center gap-3 rounded-xl border p-2 text-left transition cursor-pointer ${
                              active
                                ? 'border-white/30 bg-white/[0.1]'
                                : 'border-white/[0.06] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]'
                            }`}
                          >
                            <img
                              src={getProxiedImageUrl(engineStatus.url, item.source, item.coverUrl)}
                              alt={item.title}
                              className="h-14 w-10 rounded-lg object-cover bg-zinc-900"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-white">
                                {item.title}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400">
                                <span className="truncate">
                                  {item.authors[0] || group.sourceTitle}
                                </span>
                                {item.state && (
                                  <span className="rounded bg-white/10 px-1.5 py-0.2 font-mono-tech text-[9px]">
                                    {item.state}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
