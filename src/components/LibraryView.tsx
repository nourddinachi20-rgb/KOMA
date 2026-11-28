import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart2,
  BookCheck,
  Flame,
  FolderInput,
  FolderPlus,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useT } from '../utils/i18n';
import { KNOWN_BROKEN_SOURCES } from '../utils/api';
import { resolveCleanChapters } from '../utils/chapters';
import { computeEffectiveReadingStats } from '../utils/readingStats';
import { BulkMigrateModal } from './BulkMigrateModal';
import { CustomSelect, closeAllPopovers, useClosePopoversListener } from './CustomSelect';
import { MangaCard } from './MangaCard';

export function LibraryView() {
  const t = useT();
  const {
    library,
    categories,
    history,
    stats,
    sources,
    settings,
    engineStatus,
    failedSourceKeys,
    detailsCache,
    checkingUpdates,
    checkLibraryUpdates,
    saveCategories,
    importLocalArchives,
    importLocalFolder,
    prefetchMangaDetails,
    openReader,
    openManga,
    notify,
    setActiveView,
  } = useAppStore();

  const [activeCat, setActiveCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'lastRead' | 'unread' | 'title' | 'added'>('lastRead');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [brokenOnly, setBrokenOnly] = useState(false);
  const [bulkMigrateOpen, setBulkMigrateOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  useClosePopoversListener('library-actions', () => setActionsOpen(false));
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const brokenEntries = useMemo(() => {
    if (!engineStatus.ready || sources.length === 0) return [];
    const activeMap = new Map(sources.map((s) => [s.name, s]));
    return library.filter((entry) => {
      if (entry.manga.source === 'LOCAL') return false;
      if (failedSourceKeys[entry.key]) return true;
      if (KNOWN_BROKEN_SOURCES.has(entry.manga.source)) return true;
      if (
        !entry.manga.coverUrl &&
        (entry.totalChapters ?? 0) === 0 &&
        (entry.manga.chapters?.length ?? 0) === 0
      ) {
        return true;
      }
      const src = activeMap.get(entry.manga.source);
      return !src || src.isBroken;
    });
  }, [library, sources, engineStatus.ready, failedSourceKeys]);

  // Keep populated shelves in front of empty default shelves while preserving custom order
  const orderedCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of categories) counts.set(c.id, 0);
    for (const e of library) {
      for (const cid of e.categoryIds) {
        counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }
    }
    return [...categories].sort((a, b) => {
      const aEmpty = (counts.get(a.id) ?? 0) === 0 ? 1 : 0;
      const bEmpty = (counts.get(b.id) ?? 0) === 0 ? 1 : 0;
      if (aEmpty !== bEmpty) return aEmpty - bEmpty;
      return a.order - b.order;
    });
  }, [categories, library]);

  const brokenKeySet = useMemo(
    () => new Set(brokenEntries.map((e) => e.key)),
    [brokenEntries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = library.filter((entry) => {
      if (brokenOnly && !brokenKeySet.has(entry.key)) return false;
      if (activeCat !== 'all' && !entry.categoryIds.includes(activeCat)) return false;
      if (unreadOnly && (entry.unreadCount ?? 0) <= 0) return false;
      if (q && !entry.manga.title.toLowerCase().includes(q)) return false;
      return true;
    });

    const histTime = new Map<string, number>();
    for (const h of history) histTime.set(h.key, h.updatedAt);

    return [...list].sort((a, b) => {
      if (sortBy === 'unread') {
        return (b.unreadCount ?? 0) - (a.unreadCount ?? 0) || a.manga.title.localeCompare(b.manga.title);
      }
      if (sortBy === 'title') {
        return a.manga.title.localeCompare(b.manga.title);
      }
      if (sortBy === 'added') {
        return b.addedAt - a.addedAt;
      }
      const aT = histTime.get(a.key) ?? a.lastReadAt ?? a.addedAt;
      const bT = histTime.get(b.key) ?? b.lastReadAt ?? b.addedAt;
      return bT - aT;
    });
  }, [library, history, activeCat, unreadOnly, brokenOnly, brokenKeySet, search, sortBy]);

  const handleQuickPlay = async (entry: (typeof library)[number]) => {
    const hist = history.find((h) => h.key === entry.key);
    let chapters = detailsCache[entry.key]?.chapters ?? entry.manga.chapters ?? null;
    if (!chapters || chapters.length === 0) {
      notify(`Fetching chapters for "${entry.manga.title}"...`, 'info');
      const full = await prefetchMangaDetails(entry.manga);
      chapters = full?.chapters ?? null;
    }
    if (!chapters || chapters.length === 0) {
      openManga(entry.manga);
      return;
    }
    const readSet = new Set(entry.readChapterIds ?? []);
    const dupMode = settings.mangaDupPrefs?.[entry.key] ?? settings.chapterDupMode ?? 'dedupe';
    const cleanChapters = resolveCleanChapters(chapters, { mode: dupMode, readIds: readSet }).chapters;
    const histIdx = hist ? cleanChapters.findIndex((c) => c.id === hist.chapterId) : -1;
    const unreadIdx = cleanChapters.findIndex((c) => !readSet.has(c.id));
    const idx = histIdx >= 0 ? histIdx : unreadIdx >= 0 ? unreadIdx : 0;
    openReader({
      manga: detailsCache[entry.key] ?? entry.manga,
      chapters: cleanChapters,
      chapterIndex: idx,
      initialPage: histIdx >= 0 ? hist?.pageIndex : 0,
    });
  };

  const effectiveStats = useMemo(
    () => computeEffectiveReadingStats(library, history, stats),
    [library, history, stats],
  );

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    const next = [
      ...categories,
      {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36),
        name,
        order: categories.length,
      },
    ];
    await saveCategories(next);
    setNewCatName('');
    setAddingCat(false);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            {t.library.title}
          </h1>
          <span className="text-xs text-zinc-500">
            {library.length}
          </span>
        </div>

        <div className="relative flex items-center gap-1.5">
          <button
            onClick={() => setShowFilters((s) => !s)}
            title="Search & Sort"
            className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition cursor-pointer ${
              showFilters || search || unreadOnly
                ? 'accent-bg border-white/35'
                : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filter</span>
          </button>

          <button
            onClick={() => setShowStats((s) => !s)}
            title="Stats"
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition cursor-pointer ${
              showStats
                ? 'accent-bg border-white/35'
                : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:text-white'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
          </button>

          <button
            onClick={() => {
              if (!actionsOpen) closeAllPopovers('library-actions');
              setActionsOpen((o) => !o);
            }}
            title="More"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/25 hover:text-white cursor-pointer"
          >
            {checkingUpdates ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </button>

          {actionsOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setActionsOpen(false)}
              />
              <div className="absolute right-0 top-11 z-40 w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#0C0C10] p-1.5 shadow-2xl">
              <button
                onClick={() => {
                  setActionsOpen(false);
                  void checkLibraryUpdates();
                }}
                disabled={checkingUpdates || library.length === 0}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t.library.checkUpdates}</span>
              </button>
              <button
                onClick={() => {
                  setActionsOpen(false);
                  void importLocalArchives();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 cursor-pointer"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>{t.library.importCbz}</span>
              </button>
              <button
                onClick={() => {
                  setActionsOpen(false);
                  void importLocalFolder();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 cursor-pointer"
              >
                <FolderInput className="h-3.5 w-3.5" />
                <span>{t.library.importFolder}</span>
              </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Collapsible Filter / Search Bar (hidden by default so Library grid is front & center) */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5 sm:px-6">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter library..."
              className="w-full rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-9 pr-4 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none"
            />
          </div>

          <CustomSelect
            value={sortBy}
            onChange={(val) => setSortBy(val as typeof sortBy)}
            options={[
              { value: 'lastRead', label: t.library.sortLastRead },
              { value: 'unread', label: t.library.sortUnread },
              { value: 'title', label: t.library.sortTitle },
              { value: 'added', label: t.library.sortAdded },
            ]}
          />

          <button
            onClick={() => setUnreadOnly((u) => !u)}
            className={`inline-flex items-center justify-center rounded-full border px-3.5 py-2 text-xs font-medium leading-none transition cursor-pointer ${
              unreadOnly
                ? 'accent-bg border-white/40'
                : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:text-white'
            }`}
          >
            {t.library.unreadOnly}
          </button>
        </div>
      )}

      {/* Collapsible Stats Strip */}
      {showStats && (
        <div className="grid grid-cols-2 gap-2 border-b border-white/[0.05] bg-white/[0.015] px-4 py-3 sm:grid-cols-3 lg:grid-cols-5 sm:px-6">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <BookCheck className="h-4 w-4 shrink-0 accent-fg" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">{effectiveStats.seriesRead.toLocaleString()}</div>
              <div className="truncate text-[10px] text-zinc-500">{t.library.seriesRead}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <BookCheck className="h-4 w-4 shrink-0 text-zinc-300" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">{effectiveStats.chaptersCompleted.toLocaleString()}</div>
              <div className="truncate text-[10px] text-zinc-500">{t.library.chaptersFinished}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <Sparkles className="h-4 w-4 shrink-0 text-zinc-300" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">{effectiveStats.pagesRead.toLocaleString()}</div>
              <div className="truncate text-[10px] text-zinc-500">{t.library.pagesRead}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <Flame className="h-4 w-4 shrink-0 accent-fg" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">{effectiveStats.streakDays}d</div>
              <div className="truncate text-[10px] text-zinc-500">{t.library.streak}</div>
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{effectiveStats.topGenre ?? '—'}</div>
              <div className="truncate text-[10px] text-zinc-500">{t.library.topGenre}</div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/[0.05] px-4 py-2 no-scrollbar sm:px-6">
        <button
          onClick={() => setActiveCat('all')}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
            activeCat === 'all'
              ? 'accent-bg'
              : 'border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white'
          }`}
        >
          {t.library.all} ({library.length})
        </button>

        {orderedCategories.map((cat) => {
          const count = library.filter((e) => e.categoryIds.includes(cat.id)).length;
          const active = activeCat === cat.id;
          return (
            <div key={cat.id} className="group relative flex shrink-0 items-center">
              <button
                onClick={() => setActiveCat(cat.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-white text-black'
                    : 'border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white'
                }`}
              >
                {cat.name} ({count})
              </button>
              {categories.length > 1 && (
                <button
                  onClick={() => {
                    if (activeCat === cat.id) setActiveCat('all');
                    saveCategories(categories.filter((c) => c.id !== cat.id));
                  }}
                  title="Delete category"
                  className="ml-1 hidden rounded-full p-1 text-zinc-500 hover:text-rose-400 group-hover:inline-flex cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {addingCat ? (
          <form onSubmit={handleAddCategory} className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Shelf name..."
              className="w-28 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black cursor-pointer"
            >
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingCat(true)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-white/15 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/30 hover:text-white cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>New Shelf</span>
          </button>
        )}
      </div>

      {/* Broken Source Detector Banner */}
      {brokenEntries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/20 bg-rose-500/[0.08] px-4 py-2 text-xs sm:px-6">
          <div className="flex items-center gap-2 text-rose-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span>
              {brokenEntries.length} manga from broken or unavailable sources
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBrokenOnly((b) => !b)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition cursor-pointer ${
                brokenOnly
                  ? 'border-rose-400 bg-rose-500 text-black'
                  : 'border-rose-400/30 text-rose-200 hover:bg-rose-500/15'
              }`}
            >
              {brokenOnly ? 'Showing Broken' : 'Filter Broken'}
            </button>
            <button
              type="button"
              onClick={() => setBulkMigrateOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-[11px] font-semibold text-black hover:bg-zinc-200 cursor-pointer"
            >
              <ArrowRightLeft className="h-3 w-3" />
              <span>Migrate All</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((entry) => {
              const hist = history.find((h) => h.key === entry.key);
              const pct =
                hist && hist.totalPages > 0
                  ? Math.round(((hist.pageIndex + 1) / hist.totalPages) * 100)
                  : undefined;
              return (
                <MangaCard
                  key={entry.key}
                  manga={entry.manga}
                  broken={brokenKeySet.has(entry.key)}
                  showSource={false}
                  subtitle={hist ? `Ch. ${hist.chapterNumber || '?'}` : undefined}
                  progressPercent={pct}
                  onQuickPlay={() => void handleQuickPlay(entry)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-xl font-bold text-zinc-200">Nothing here yet</p>
            <p className="mt-2 max-w-sm text-xs text-zinc-500">
              Add manga to your library or import a .cbz / .zip file.
            </p>
            <button
              onClick={() => setActiveView('explore')}
              className="mt-5 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black cursor-pointer"
            >
              Explore Sources
            </button>
          </div>
        )}
      </div>

      <BulkMigrateModal
        open={bulkMigrateOpen}
        entries={brokenEntries}
        onClose={() => setBulkMigrateOpen(false)}
      />
    </div>
  );
}
