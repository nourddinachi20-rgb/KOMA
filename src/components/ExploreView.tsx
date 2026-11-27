import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Globe, Loader2, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Manga, MangaTag, SortOrder } from '../types';
import { fetchMangaList, fetchSourceFilters, updateSourceDomain } from '../utils/api';
import { useT } from '../utils/i18n';
import { MangaCard } from './MangaCard';

export function ExploreView() {
  const t = useT();
  const {
    engineStatus,
    sources,
    exploreSource,
    setExploreSource,
    settings,
    filtersCache,
    exploreCache,
    setFilterCache,
    setExploreCache,
  } = useAppStore();

  const cachedExplore = exploreCache[exploreSource];
  const filterMeta = filtersCache[exploreSource] ?? null;

  const [sourceSearch, setSourceSearch] = useState('');
  const [langFilter, setLangFilter] = useState<'all' | 'en' | 'fr' | 'ar' | 'multi'>('all');
  const [query, setQuery] = useState(cachedExplore?.query ?? '');
  const [sortOrder, setSortOrder] = useState<SortOrder>(cachedExplore?.sortOrder ?? 'POPULARITY');
  const [selectedTags, setSelectedTags] = useState<MangaTag[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  const [items, setItems] = useState<Manga[]>(cachedExplore?.items ?? []);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const visibleSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    return sources
      .filter((s) => {
        if (!settings.showNsfw && s.contentType === 'HENTAI') return false;
        const loc = s.locale || 'multi';
        if (langFilter !== 'all' && loc !== langFilter) return false;
        if (q) {
          return (
            s.title.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            loc.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const aPin = settings.pinnedSources.includes(a.name) ? 0 : 1;
        const bPin = settings.pinnedSources.includes(b.name) ? 0 : 1;
        if (aPin !== bPin) return aPin - bPin;
        return a.title.localeCompare(b.title);
      });
  }, [sources, sourceSearch, langFilter, settings.showNsfw, settings.pinnedSources]);

  // Sync local state immediately from exploreCache when switching source
  useEffect(() => {
    const cached = exploreCache[exploreSource];
    setSelectedTags([]);
    setQuery(cached?.query ?? '');
    setItems(cached?.items ?? []);
    setHasMore(true);
    if (cached?.sortOrder) setSortOrder(cached.sortOrder);

    if (!engineStatus.ready || !engineStatus.url || !exploreSource) return;
    if (filtersCache[exploreSource]) {
      const meta = filtersCache[exploreSource];
      if (meta.sortOrders.length > 0 && !meta.sortOrders.includes(sortOrder)) {
        setSortOrder(meta.sortOrders[0]);
      }
      return;
    }

    let cancelled = false;
    fetchSourceFilters(engineStatus.url, exploreSource)
      .then((meta) => {
        if (cancelled) return;
        setFilterCache(exploreSource, meta);
        if (meta.sortOrders.length > 0 && !meta.sortOrders.includes(sortOrder)) {
          setSortOrder(meta.sortOrders[0]);
        }
      })
      .catch(() => {
        // Non-fatal
      });

    return () => {
      cancelled = true;
    };
  }, [engineStatus.ready, engineStatus.url, exploreSource]);

  const loadList = useCallback(async (offset = 0, append = false, force = false) => {
    if (!engineStatus.ready || !engineStatus.url || !exploreSource) return;

    // Instant cache hit when returning to Explore tab with same filters
    const cached = exploreCache[exploreSource];
    if (
      !force &&
      !append &&
      offset === 0 &&
      selectedTags.length === 0 &&
      cached &&
      cached.items.length > 0 &&
      cached.sortOrder === sortOrder &&
      cached.query === query.trim()
    ) {
      setItems(cached.items);
      setHasMore(true);
      return;
    }

    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setHasMore(true);
    }
    setError(null);

    try {
      const next = await fetchMangaList(engineStatus.url, exploreSource, {
        offset,
        order: sortOrder,
        query: query.trim() || undefined,
        tags: selectedTags,
      });
      if (append && next.length === 0) {
        setHasMore(false);
        return;
      }
      const seen = new Set<string>();
      const combined = append ? [...items, ...next] : next;
      const updated = combined.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      if (append && updated.length === items.length) {
        setHasMore(false);
      }
      setItems(updated);
      if (selectedTags.length === 0) {
        setExploreCache(exploreSource, {
          items: updated,
          sortOrder,
          query: query.trim(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [engineStatus.ready, engineStatus.url, exploreSource, exploreCache, selectedTags, sortOrder, query, items, setExploreCache]);

  useEffect(() => {
    void loadList(0, false, false);
  }, [engineStatus.ready, engineStatus.url, exploreSource, sortOrder, selectedTags]);

  // Infinite scroll sentinel observer
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore || items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore && !loading && hasMore) {
          void loadList(items.length, true, true);
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, items.length, loadList]);

  const currentSourceInfo = sources.find((s) => s.name === exploreSource);

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Mobile Backdrop */}
      {mobileRailOpen && (
        <div
          onClick={() => setMobileRailOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 md:hidden"
        />
      )}

      {/* Adaptive Source Rail: Drawer on Phone, Docked Rail on Tablet/Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-white/[0.08] bg-[#060609] p-3 transition-transform duration-200 md:static md:w-64 md:translate-x-0 md:bg-black/50 ${
          mobileRailOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={sourceSearch}
            onChange={(e) => setSourceSearch(e.target.value)}
            placeholder={`Filter ${sources.length} working sources...`}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none"
          />
        </div>

        <div className="mb-2.5 flex items-center gap-1">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'en', label: 'EN' },
              { id: 'fr', label: 'FR' },
              { id: 'ar', label: 'AR' },
              { id: 'multi', label: 'Multi' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setLangFilter(t.id)}
              className={`flex-1 rounded-lg py-1 font-mono-tech text-[10px] transition cursor-pointer ${
                langFilter === t.id
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleSources.map((src) => {
            const active = src.name === exploreSource;
            const pinned = settings.pinnedSources.includes(src.name);
            return (
              <button
                key={src.name}
                onClick={() => {
                  setExploreSource(src.name);
                  setMobileRailOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition cursor-pointer ${
                  active
                    ? 'bg-white text-black font-semibold shadow-[0_4px_20px_rgba(255,255,255,0.2)]'
                    : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="truncate">{src.title}</span>
                <div className="ml-2 flex items-center gap-1.5 shrink-0">
                  {pinned && !active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white/50" title="Pinned" />
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono-tech text-[9px] uppercase ${
                      active ? 'bg-black/15 text-black' : 'bg-white/[0.06] text-zinc-500'
                    }`}
                  >
                    {src.locale || 'ALL'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Catalog Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileRailOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white md:hidden cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 accent-fg" />
              <span>{t.explore.sources}</span>
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                {currentSourceInfo?.title ?? exploreSource}
              </h1>
              <p className="font-mono-tech text-[11px] text-zinc-500">
                {filterMeta?.domain ?? currentSourceInfo?.domain ?? 'Ready'} ·{' '}
                {currentSourceInfo?.contentType ?? 'MANGA'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void loadList(0, false, true);
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.explore.searchPlaceholder}
                className="w-56 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-9 pr-4 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
              />
            </form>

            {filterMeta && filterMeta.sortOrders.length > 0 && (
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
              >
                {filterMeta.sortOrders.map((o) => (
                  <option key={o} value={o} className="bg-zinc-950">
                    {o.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            )}

            {filterMeta && filterMeta.domains.length > 1 && (
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-zinc-300">
                <Globe className="h-3.5 w-3.5 text-zinc-400" />
                <select
                  value={filterMeta.domain}
                  onChange={async (e) => {
                    if (!engineStatus.url) return;
                    const newDom = await updateSourceDomain(
                      engineStatus.url,
                      exploreSource,
                      e.target.value,
                    );
                    setFilterCache(exploreSource, { ...filterMeta, domain: newDom });
                    void loadList(0, false, true);
                  }}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  {filterMeta.domains.map((d) => (
                    <option key={d} value={d} className="bg-zinc-950">
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filterMeta && filterMeta.availableTags.length > 0 && (
              <button
                onClick={() => setShowFilters((s) => !s)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition cursor-pointer ${
                  showFilters || selectedTags.length > 0
                    ? 'border-white/30 bg-white text-black font-medium'
                    : 'border-white/10 bg-white/[0.05] text-zinc-300 hover:border-white/25'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Tags {selectedTags.length > 0 ? `(${selectedTags.length})` : ''}</span>
              </button>
            )}

            <button
              onClick={() => loadList(0, false, true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:border-white/25 hover:text-white cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {showFilters && filterMeta && (
          <div className="border-b border-white/[0.07] bg-white/[0.02] px-6 py-3">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" /> Filter by Genre / Tag
              </span>
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-zinc-300 underline hover:text-white cursor-pointer"
                >
                  Clear tags
                </button>
              )}
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {filterMeta.availableTags.map((tag) => {
                const active = selectedTags.some((t) => t.key === tag.key);
                return (
                  <button
                    key={tag.key}
                    onClick={() => {
                      if (active) {
                        setSelectedTags((prev) => prev.filter((t) => t.key !== tag.key));
                      } else if (filterMeta.capabilities.isMultipleTagsSupported) {
                        setSelectedTags((prev) => [...prev, tag]);
                      } else {
                        setSelectedTags([tag]);
                      }
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] transition cursor-pointer ${
                      active
                        ? 'bg-white text-black font-medium'
                        : 'border border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    {tag.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs text-rose-200">
              {error} — Try switching mirror domain above or picking another source from the left rail.
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {items.map((item) => (
                  <MangaCard key={`${exploreSource}-${item.id}`} manga={item} />
                ))}
              </div>

              {items.length > 0 && (
                <div ref={loadMoreSentinelRef} className="mt-8 flex justify-center pb-8">
                  {loadingMore ? (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-xs text-zinc-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading more...</span>
                    </div>
                  ) : hasMore ? (
                    <button
                      onClick={() => void loadList(items.length, true, true)}
                      className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-2.5 text-xs font-medium text-white transition hover:border-white/30 hover:bg-white/10 cursor-pointer"
                    >
                      <span>Load More</span>
                    </button>
                  ) : (
                    <span className="font-mono-tech text-[11px] text-zinc-600">
                      End of catalog ({items.length} titles)
                    </span>
                  )}
                </div>
              )}

              {!loading && items.length === 0 && !error && (
                <div className="py-20 text-center text-sm text-zinc-500">
                  No results found for this query.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
