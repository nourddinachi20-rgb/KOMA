import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightLeft, Loader2, Search, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Manga } from '../types';
import { getProxiedImageUrl, searchAcrossSources } from '../utils/api';

interface MigrateModalProps {
  open: boolean;
  manga: Manga;
  onClose: () => void;
}

export function MigrateModal({ open, manga, onClose }: MigrateModalProps) {
  const { engineStatus, sources, settings, migrateLibraryManga, prefetchMangaDetails } =
    useAppStore();

  const [query, setQuery] = useState(manga.title);
  const [loading, setLoading] = useState(false);
  const [migratingKey, setMigratingKey] = useState<string | null>(null);
  const [groups, setGroups] = useState<
    Array<{ source: string; sourceTitle: string; items: Manga[]; chapterCounts: Record<string, number> }>
  >([]);

  const runSearch = async (q: string) => {
    if (!q.trim() || !engineStatus.ready || !engineStatus.url) return;
    setLoading(true);
    try {
      const targets = Array.from(
        new Set([
          ...settings.pinnedSources,
          ...sources.filter((s) => s.locale === 'en' || s.locale === '').slice(0, 8).map((s) => s.name),
        ]),
      )
        .filter((s) => s !== manga.source)
        .slice(0, 10);

      const res = await searchAcrossSources(engineStatus.url, q.trim(), targets);
      const nonEmpty = res
        .filter((g) => g.items.length > 0)
        .map((g) => ({ ...g, chapterCounts: {} as Record<string, number> }));
      setGroups(nonEmpty);

      // Enrich top match per source to display chapter count comparison
      for (const g of nonEmpty) {
        const top = g.items[0];
        if (!top) continue;
        void prefetchMangaDetails(top).then((full) => {
          if (!full?.chapters) return;
          setGroups((prev) =>
            prev.map((grp) =>
              grp.source === g.source
                ? {
                    ...grp,
                    chapterCounts: { ...grp.chapterCounts, [top.id]: full.chapters!.length },
                  }
                : grp,
            ),
          );
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setQuery(manga.title);
      void runSearch(manga.title);
    }
  }, [open, manga.title]);

  const handleMigrate = async (target: Manga) => {
    const k = `${target.source}::${target.id}`;
    setMigratingKey(k);
    try {
      await migrateLibraryManga(`${manga.source}::${manga.id}`, target);
      onClose();
    } finally {
      setMigratingKey(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="oled-glass flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <ArrowRightLeft className="h-4 w-4 accent-fg" />
                <h2 className="text-base font-bold text-white">Migrate Source</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch(query);
              }}
              className="flex items-center gap-2 border-b border-white/[0.06] px-6 py-3"
            >
              <Search className="h-4 w-4 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                placeholder="Search title across sources..."
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black cursor-pointer"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {loading && groups.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-12 text-xs text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Scanning sources for "{query}"...</span>
                </div>
              )}

              {groups.map((g) => (
                <div key={g.source}>
                  <h4 className="mb-2 font-mono-tech text-[10px] uppercase tracking-widest text-zinc-500">
                    {g.sourceTitle}
                  </h4>
                  <div className="space-y-2">
                    {g.items.slice(0, 3).map((item) => {
                      const k = `${item.source}::${item.id}`;
                      const chCount = g.chapterCounts[item.id];
                      const busy = migratingKey === k;
                      return (
                        <div
                          key={k}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={getProxiedImageUrl(engineStatus.url, item.source, item.coverUrl)}
                              alt=""
                              className="h-14 w-10 rounded-lg object-cover bg-zinc-900"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">
                                {item.title}
                              </div>
                              <div className="mt-0.5 font-mono-tech text-[11px] text-zinc-400">
                                {g.sourceTitle}
                                {typeof chCount === 'number' ? ` · ${chCount} chapters` : ''}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => void handleMigrate(item)}
                            disabled={Boolean(migratingKey)}
                            className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40 cursor-pointer"
                          >
                            {busy ? 'Migrating...' : 'Migrate Here'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {!loading && groups.length === 0 && (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No matches found on other pinned sources. Try adjusting the search title above.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
