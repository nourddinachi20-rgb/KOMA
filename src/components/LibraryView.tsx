import { useMemo, useState } from 'react';
import {
  BookCheck,
  Flame,
  FolderInput,
  FolderPlus,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useT } from '../utils/i18n';
import { MangaCard } from './MangaCard';

function computeStreakDays(days: string[]): number {
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

export function LibraryView() {
  const t = useT();
  const {
    library,
    categories,
    history,
    stats,
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
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = library.filter((entry) => {
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
  }, [library, history, activeCat, unreadOnly, search, sortBy]);

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
    const histIdx = hist ? chapters.findIndex((c) => c.id === hist.chapterId) : -1;
    const unreadIdx = chapters.findIndex((c) => !readSet.has(c.id));
    const idx = histIdx >= 0 ? histIdx : unreadIdx >= 0 ? unreadIdx : 0;
    openReader({
      manga: detailsCache[entry.key] ?? entry.manga,
      chapters,
      chapterIndex: idx,
      initialPage: histIdx >= 0 ? hist?.pageIndex : 0,
    });
  };

  const topGenre = useMemo(() => {
    const entries = Object.entries(stats.genreCounts);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [stats.genreCounts]);

  const streak = useMemo(() => computeStreakDays(stats.activeDays), [stats.activeDays]);

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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t.library.title}</h1>
          <p className="font-mono-tech text-xs text-zinc-500">
            {library.length} {t.library.seriesCount}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter library..."
              className="w-44 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-9 pr-4 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
          >
            <option value="lastRead" className="bg-zinc-950">{t.library.sortLastRead}</option>
            <option value="unread" className="bg-zinc-950">{t.library.sortUnread}</option>
            <option value="title" className="bg-zinc-950">{t.library.sortTitle}</option>
            <option value="added" className="bg-zinc-950">{t.library.sortAdded}</option>
          </select>

          <button
            onClick={() => setUnreadOnly((u) => !u)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              unreadOnly
                ? 'accent-bg border-white/40'
                : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:text-white'
            }`}
          >
            {t.library.unreadOnly}
          </button>

          <button
            onClick={() => void checkLibraryUpdates()}
            disabled={checkingUpdates || library.length === 0}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white transition hover:border-white/30 hover:bg-white/10 disabled:opacity-40 cursor-pointer"
          >
            {checkingUpdates ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>{checkingUpdates ? t.library.checking : t.library.checkUpdates}</span>
          </button>

          <button
            onClick={importLocalArchives}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white transition hover:border-white/30 hover:bg-white/10 cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>{t.library.importCbz}</span>
          </button>

          <button
            onClick={importLocalFolder}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white transition hover:border-white/30 hover:bg-white/10 cursor-pointer"
          >
            <FolderInput className="h-3.5 w-3.5" />
            <span>{t.library.importFolder}</span>
          </button>
        </div>
      </div>

      {/* Reading Stats Strip */}
      <div className="grid grid-cols-2 gap-2.5 border-b border-white/[0.05] bg-white/[0.015] px-6 py-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2">
          <BookCheck className="h-4 w-4 accent-fg" />
          <div>
            <div className="font-mono-tech text-sm font-bold text-white">
              {stats.chaptersCompleted}
            </div>
            <div className="text-[10px] text-zinc-500">{t.library.chaptersFinished}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2">
          <Sparkles className="h-4 w-4 text-zinc-300" />
          <div>
            <div className="font-mono-tech text-sm font-bold text-white">{stats.pagesRead}</div>
            <div className="text-[10px] text-zinc-500">{t.library.pagesRead}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2">
          <Flame className="h-4 w-4 accent-fg" />
          <div>
            <div className="font-mono-tech text-sm font-bold text-white">{streak}d</div>
            <div className="text-[10px] text-zinc-500">{t.library.streak}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2">
          <div className="min-w-0">
            <div className="truncate font-mono-tech text-sm font-bold text-white">
              {topGenre ?? '—'}
            </div>
            <div className="text-[10px] text-zinc-500">{t.library.topGenre}</div>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/[0.05] px-6 py-3 no-scrollbar">
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

        {categories.map((cat) => {
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

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
                  subtitle={hist ? `Ch. ${hist.chapterNumber || '?'}` : undefined}
                  progressPercent={pct}
                  onQuickPlay={() => void handleQuickPlay(entry)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-editorial text-3xl text-zinc-300">Nothing on this shelf yet</p>
            <p className="mt-2 max-w-sm text-xs text-zinc-500">
              Bookmark any series, or drag-and-drop .cbz / .zip files or manga folders right onto KOMA.
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
    </div>
  );
}
