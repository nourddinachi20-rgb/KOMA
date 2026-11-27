import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRightLeft,
  Bookmark,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  Play,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { AniListMediaInfo, Manga } from '../types';
import { getProxiedImageUrl } from '../utils/api';
import { extractAmbientColor } from '../utils/colorExtractor';
import { MigrateModal } from './MigrateModal';

export function MangaDetailsPage() {
  const {
    selectedManga,
    closeManga,
    engineStatus,
    library,
    categories,
    history,
    downloads,
    downloadProgress,
    settings,
    detailsCache,
    prefetchMangaDetails,
    toggleLibraryManga,
    updateLibraryCategories,
    markChapterRead,
    markPreviousChaptersRead,
    openReader,
    queueDownload,
    openCommandWithQuery,
  } = useAppStore();

  const [details, setDetails] = useState<Manga | null>(null);
  const [anilist, setAnilist] = useState<AniListMediaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ambientRgb, setAmbientRgb] = useState('234, 194, 120');
  const [sortDesc, setSortDesc] = useState(true);
  const [chapterFilter, setChapterFilter] = useState('');
  const [chapterPage, setChapterPage] = useState(1);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [expandDesc, setExpandDesc] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !migrateOpen) closeManga();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeManga, migrateOpen]);

  useEffect(() => {
    if (!selectedManga) {
      setDetails(null);
      setAnilist(null);
      setError(null);
      setChapterFilter('');
      setExpandDesc(false);
      return;
    }
    const cacheKey = `${selectedManga.source}::${selectedManga.id}`;
    const cached = detailsCache[cacheKey];
    setDetails(cached ?? selectedManga);
    setError(null);
    setExpandDesc(false);

    const coverUrl = getProxiedImageUrl(
      engineStatus.url,
      selectedManga.source,
      selectedManga.coverUrl || selectedManga.largeCoverUrl,
    );
    if (settings.ambientGlow && coverUrl) {
      extractAmbientColor(coverUrl).then(setAmbientRgb);
    }

    let cancelled = false;
    const initialAlt = selectedManga.altTitles?.join(' · ');
    void window.noctis
      .fetchAniListMetadata(selectedManga.title, initialAlt)
      .then((meta) => {
        if (!cancelled) setAnilist(meta);
      });

    if (cached && cached.chapters !== null) {
      const branches = Array.from(
        new Set((cached.chapters ?? []).map((c) => c.branch ?? null)),
      );
      setSelectedBranch(branches[0] ?? null);
      return () => {
        cancelled = true;
      };
    }

    if (selectedManga.source === 'LOCAL' || !engineStatus.ready || !engineStatus.url) {
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    prefetchMangaDetails(selectedManga)
      .then((full) => {
        if (cancelled || !full) return;
        setDetails(full);
        const fullAlt = full.altTitles?.join(' · ');
        if (fullAlt && fullAlt !== initialAlt) {
          void window.noctis.fetchAniListMetadata(full.title, fullAlt).then((meta) => {
            if (!cancelled && meta) setAnilist(meta);
          });
        }
        const branches = Array.from(
          new Set((full.chapters ?? []).map((c) => c.branch ?? null)),
        );
        setSelectedBranch(branches[0] ?? null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedManga, engineStatus.ready, engineStatus.url, settings.ambientGlow]);

  const manga = details ?? selectedManga;
  const key = manga ? `${manga.source}::${manga.id}` : '';
  const libraryEntry = library.find((e) => e.key === key);
  const inLibrary = Boolean(libraryEntry);
  const readSet = useMemo(
    () => new Set(libraryEntry?.readChapterIds ?? []),
    [libraryEntry?.readChapterIds],
  );
  const historyItem = history.find((h) => h.key === key);

  const branches = useMemo(() => {
    if (!manga?.chapters) return [];
    const set = new Set<string>();
    for (const c of manga.chapters) {
      if (c.branch) set.add(c.branch);
    }
    return Array.from(set);
  }, [manga]);

  const ascendingChapters = useMemo(() => {
    const raw = manga?.chapters ?? [];
    return branches.length > 0 && selectedBranch
      ? raw.filter((c) => c.branch === selectedBranch)
      : raw;
  }, [manga, branches.length, selectedBranch]);

  const orderedChapters = useMemo(() => {
    const filtered = chapterFilter.trim()
      ? ascendingChapters.filter(
          (c) =>
            (c.title ?? '').toLowerCase().includes(chapterFilter.toLowerCase()) ||
            String(c.number).includes(chapterFilter),
        )
      : ascendingChapters;
    return sortDesc ? [...filtered].reverse() : filtered;
  }, [ascendingChapters, chapterFilter, sortDesc]);

  const CHAPTERS_PER_PAGE = 30;
  const totalChapterPages = Math.max(1, Math.ceil(orderedChapters.length / CHAPTERS_PER_PAGE));
  const safeChapterPage = Math.min(chapterPage, totalChapterPages);
  const paginatedChapters = useMemo(() => {
    const start = (safeChapterPage - 1) * CHAPTERS_PER_PAGE;
    return orderedChapters.slice(start, start + CHAPTERS_PER_PAGE);
  }, [orderedChapters, safeChapterPage]);

  const pageNumbers = useMemo(() => {
    if (totalChapterPages <= 7) {
      return Array.from({ length: totalChapterPages }, (_, i) => i + 1);
    }
    const pages: Array<number | '...'> = [1];
    const start = Math.max(2, safeChapterPage - 1);
    const end = Math.min(totalChapterPages - 1, safeChapterPage + 1);
    if (start > 2) pages.push('...');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalChapterPages - 1) pages.push('...');
    pages.push(totalChapterPages);
    return pages;
  }, [totalChapterPages, safeChapterPage]);

  useEffect(() => {
    setChapterPage(1);
  }, [selectedManga?.source, selectedManga?.id, chapterFilter, sortDesc, selectedBranch]);

  if (!manga) return null;

  const coverUrl = getProxiedImageUrl(
    engineStatus.url,
    manga.source,
    manga.largeCoverUrl || manga.coverUrl,
  );
  const bannerBackdrop =
    anilist?.bannerImage ||
    getProxiedImageUrl(engineStatus.url, manga.source, manga.coverUrl || manga.largeCoverUrl);

  const nextUnreadIdx = ascendingChapters.findIndex((c) => !readSet.has(c.id));

  const handlePrimaryRead = () => {
    if (ascendingChapters.length === 0) return;
    let idx = nextUnreadIdx >= 0 ? nextUnreadIdx : 0;
    let initialPage = 0;
    if (historyItem) {
      const found = ascendingChapters.findIndex((c) => c.id === historyItem.chapterId);
      if (found >= 0 && !readSet.has(historyItem.chapterId)) {
        idx = found;
        initialPage = historyItem.pageIndex;
      }
    }
    openReader({
      manga,
      chapters: ascendingChapters,
      chapterIndex: idx,
      initialPage,
    });
  };

  const handleBatchDownload = async () => {
    if (ascendingChapters.length === 0 || batchDownloading) return;
    setBatchDownloading(true);
    try {
      const startFrom = nextUnreadIdx >= 0 ? nextUnreadIdx : 0;
      const candidates = ascendingChapters
        .slice(startFrom)
        .filter((ch) => !downloads.some((d) => d.key === `${manga.source}::${manga.id}::${ch.id}`))
        .slice(0, 5);
      for (const ch of candidates) {
        await queueDownload(manga, ch);
      }
    } finally {
      setBatchDownloading(false);
    }
  };

  const toggleShelf = (catId: string) => {
    if (!libraryEntry) return;
    const exists = libraryEntry.categoryIds.includes(catId);
    const next = exists
      ? libraryEntry.categoryIds.filter((id) => id !== catId)
      : [...libraryEntry.categoryIds, catId];
    void updateLibraryCategories(libraryEntry.key, next);
  };

  const cleanDesc = manga.description?.replace(/<[^>]+>/g, '').trim() ?? '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22 }}
      className="relative h-full w-full overflow-y-auto bg-black"
    >
      {settings.ambientGlow && (
        <div
          className="pointer-events-none fixed left-1/2 top-0 h-[520px] w-[1100px] -translate-x-1/2"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, rgba(${ambientRgb}, 0.22) 0%, rgba(${ambientRgb}, 0.06) 45%, transparent 72%)`,
          }}
        />
      )}

      {bannerBackdrop && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] overflow-hidden opacity-30">
          <img
            src={bannerBackdrop}
            alt=""
            decoding="async"
            className={`h-full w-full scale-105 object-cover ${
              anilist?.bannerImage ? '' : 'blur-md'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/80 to-black" />
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pb-20 pt-4 sm:px-10">
        {/* Sticky Top Back Bar */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={closeManga}
            className="oled-glass-subtle flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            {anilist?.siteUrl && (
              <a
                href={anilist.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="oled-glass-subtle flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-zinc-300 transition hover:border-white/25 hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#EAC278]" />
                <span>AniList</span>
              </a>
            )}
            {manga.publicUrl && manga.publicUrl.startsWith('http') && (
              <a
                href={manga.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="oled-glass-subtle flex items-center gap-1.5 rounded-full px-4 py-2 text-xs text-zinc-300 transition hover:border-white/25 hover:text-white"
              >
                <span>Open Web</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Hero Metadata Section */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="w-52 shrink-0 self-center sm:w-60 lg:self-start">
            <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-white/20 bg-zinc-950 shadow-[0_28px_80px_rgba(0,0,0,0.95)]">
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt={manga.title}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tech uppercase tracking-wider text-zinc-300">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-white">
                {manga.source.replace(/_/g, ' ')}
              </span>
              {manga.state && (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                  {manga.state}
                </span>
              )}
              {(manga.rating > 0 || anilist?.averageScore) && (
                <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-amber-300">
                  <Star className="h-3 w-3 fill-amber-300" />
                  {manga.rating > 0
                    ? (manga.rating * 10).toFixed(1)
                    : `${((anilist?.averageScore ?? 0) / 10).toFixed(1)} AL`}
                </span>
              )}
              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                <Layers className="h-3 w-3 text-zinc-400" />
                {ascendingChapters.length} Chapters
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              {manga.title}
            </h1>

            {manga.altTitles.length > 0 && (
              <p className="mt-2 line-clamp-1 text-xs text-zinc-400">
                {manga.altTitles.slice(0, 3).join(' · ')}
              </p>
            )}

            {manga.authors.length > 0 && (
              <p className="mt-2 text-sm text-zinc-400">
                Author: <span className="font-medium text-zinc-200">{manga.authors.join(', ')}</span>
              </p>
            )}

            {manga.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {manga.tags.map((t) => (
                  <span
                    key={t.key}
                    className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] text-zinc-300"
                  >
                    {t.title}
                  </span>
                ))}
              </div>
            )}

            {cleanDesc && (
              <div className="mt-5 max-w-3xl">
                <p
                  className={`text-sm leading-relaxed text-zinc-300/90 ${
                    expandDesc ? '' : 'line-clamp-4'
                  }`}
                >
                  {cleanDesc}
                </p>
                {cleanDesc.length > 260 && (
                  <button
                    onClick={() => setExpandDesc((v) => !v)}
                    className="mt-1.5 text-xs font-medium text-zinc-400 underline hover:text-white cursor-pointer"
                  >
                    {expandDesc ? 'Show less' : 'Read full synopsis'}
                  </button>
                )}
              </div>
            )}

            {/* Primary Actions */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={handlePrimaryRead}
                disabled={ascendingChapters.length === 0}
                className="flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black shadow-[0_0_32px_rgba(255,255,255,0.28)] transition hover:scale-[1.02] hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-black" />
                <span>
                  {historyItem && !readSet.has(historyItem.chapterId)
                    ? `Resume Ch. ${historyItem.chapterNumber || ''} (p.${historyItem.pageIndex + 1})`
                    : nextUnreadIdx > 0
                      ? `Continue Ch. ${ascendingChapters[nextUnreadIdx]?.number || nextUnreadIdx + 1}`
                      : 'Start Reading'}
                </span>
              </button>

              <button
                onClick={() => void toggleLibraryManga(manga)}
                className={`flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition cursor-pointer ${
                  inLibrary
                    ? 'border-white/30 bg-white/15 text-white'
                    : 'border-white/15 bg-white/[0.05] text-zinc-200 hover:border-white/30 hover:bg-white/10'
                }`}
              >
                {inLibrary ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>In Library</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    <span>Add to Library</span>
                  </>
                )}
              </button>

              {manga.source !== 'LOCAL' && (
                <>
                  <button
                    onClick={() => setMigrateOpen(true)}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    <span>Migrate Source</span>
                  </button>

                  {ascendingChapters.length > 0 && (
                    <button
                      onClick={handleBatchDownload}
                      disabled={batchDownloading}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      {batchDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      <span>Download Next 5</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {inLibrary && categories.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-500">
                  Shelves:
                </span>
                {categories.map((cat) => {
                  const active = libraryEntry?.categoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleShelf(cat.id)}
                      className={`rounded-full px-3 py-1 text-[11px] transition cursor-pointer ${
                        active
                          ? 'bg-white text-black font-semibold'
                          : 'border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chapters Directory */}
        <div className="mt-12 border-t border-white/[0.08] pt-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">
                Chapters{' '}
                <span className="font-mono-tech text-sm font-normal text-zinc-500">
                  ({orderedChapters.length})
                </span>
              </h2>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {branches.length > 1 && (
                <select
                  value={selectedBranch ?? ''}
                  onChange={(e) => setSelectedBranch(e.target.value || null)}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b} value={b} className="bg-zinc-950">
                      {b}
                    </option>
                  ))}
                </select>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  value={chapterFilter}
                  onChange={(e) => setChapterFilter(e.target.value)}
                  placeholder="Filter chapters..."
                  className="w-48 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-9 pr-4 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none"
                />
              </div>

              <button
                onClick={() => setSortDesc((s) => !s)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-zinc-300 transition hover:border-white/25 hover:text-white cursor-pointer"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                <span>{sortDesc ? 'Newest First' : 'Oldest First'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              Failed to refresh from {manga.source}: {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {paginatedChapters.map((ch) => {
              const dlKey = `${manga.source}::${manga.id}::${ch.id}`;
              const downloaded = downloads.some((d) => d.key === dlKey);
              const prog = downloadProgress[dlKey];
              const isRead = readSet.has(ch.id);
              const isLastRead = historyItem?.chapterId === ch.id;
              const ascIdx = ascendingChapters.findIndex((c) => c.id === ch.id);

              return (
                <div
                  key={ch.id}
                  onClick={() =>
                    openReader({
                      manga,
                      chapters: ascendingChapters,
                      chapterIndex: ascIdx >= 0 ? ascIdx : 0,
                      initialPage: isLastRead ? historyItem?.pageIndex : 0,
                    })
                  }
                  className={`cv-chapter group flex items-center justify-between rounded-2xl border px-4 py-3.5 transition cursor-pointer ${
                    isLastRead
                      ? 'border-white/30 bg-white/[0.09]'
                      : isRead
                        ? 'border-white/[0.04] bg-white/[0.015] opacity-55 hover:opacity-90'
                        : 'border-white/[0.06] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-tech text-xs font-semibold text-white">
                        {ch.number > 0 ? `Ch. ${ch.number}` : 'Chapter'}
                      </span>
                      {ch.title && (
                        <span className="truncate text-sm text-zinc-300">{ch.title}</span>
                      )}
                      {isLastRead && (
                        <span className="rounded-full bg-white px-2 py-0.5 font-mono-tech text-[9px] font-semibold uppercase text-black">
                          p.{historyItem.pageIndex + 1}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
                      {ch.scanlator && <span className="truncate">{ch.scanlator}</span>}
                      {ch.uploadDate > 0 && (
                        <span className="font-mono-tech">
                          {new Date(ch.uploadDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {inLibrary && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void markPreviousChaptersRead(manga, ch.id);
                          }}
                          title="Mark previous chapters as read"
                          className="hidden h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:text-white group-hover:flex cursor-pointer"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void markChapterRead(manga, ch.id, !isRead, ch.number);
                          }}
                          title={isRead ? 'Mark as unread' : 'Mark as read'}
                          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
                            isRead
                              ? 'border-white/30 bg-white text-black'
                              : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    {manga.source !== 'LOCAL' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!downloaded && !prog) void queueDownload(manga, ch);
                        }}
                        title={downloaded ? 'Downloaded offline' : 'Download chapter'}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
                          downloaded
                            ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
                            : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {prog ? (
                          <span className="font-mono-tech text-[9px]">
                            {Math.round((prog.done / Math.max(1, prog.total)) * 100)}%
                          </span>
                        ) : downloaded ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalChapterPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
              <div className="font-mono-tech text-[11px] text-zinc-500">
                Showing {(safeChapterPage - 1) * CHAPTERS_PER_PAGE + 1}–
                {Math.min(safeChapterPage * CHAPTERS_PER_PAGE, orderedChapters.length)} of{' '}
                {orderedChapters.length} chapters
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setChapterPage((p) => Math.max(1, p - 1))}
                  disabled={safeChapterPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-35 cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {pageNumbers.map((item, idx) =>
                  item === '...' ? (
                    <span
                      key={`dots-${idx}`}
                      className="px-1.5 font-mono-tech text-xs text-zinc-600"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setChapterPage(item)}
                      className={`flex h-8 min-w-8 items-center justify-center rounded-xl border px-2.5 font-mono-tech text-xs transition cursor-pointer ${
                        safeChapterPage === item
                          ? 'border-white bg-white font-semibold text-black'
                          : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}

                <button
                  onClick={() => setChapterPage((p) => Math.min(totalChapterPages, p + 1))}
                  disabled={safeChapterPage === totalChapterPages}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-35 cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {!loading && orderedChapters.length === 0 && (
            <div className="py-16 text-center text-sm text-zinc-500">
              No chapters returned by this source yet.
            </div>
          )}
        </div>

        {/* AniList Recommendations & Relations */}
        {anilist && (anilist.recommendations.length > 0 || anilist.relations.length > 0) && (
          <div className="mt-12 space-y-8 border-t border-white/[0.08] pt-8">
            {anilist.relations.length > 0 && (
              <section>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400 font-mono-tech">
                  Related Entries
                </h3>
                <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                  {anilist.relations.map((rel) => (
                    <button
                      key={rel.id}
                      onClick={() => openCommandWithQuery(rel.title)}
                      className="group w-32 shrink-0 text-left cursor-pointer"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
                        {rel.cover && (
                          <img
                            src={rel.cover}
                            alt={rel.title}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                        <span className="absolute left-2 top-2 rounded-md border border-white/15 bg-black/80 px-1.5 py-0.5 font-mono-tech text-[9px] uppercase tracking-wide text-[#EAC278]">
                          {rel.relationType}
                        </span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs font-medium text-zinc-300 group-hover:text-white">
                        {rel.title}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {anilist.recommendations.length > 0 && (
              <section>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400 font-mono-tech">
                  Recommended If You Like This
                </h3>
                <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                  {anilist.recommendations.map((rec) => (
                    <button
                      key={rec.id}
                      onClick={() => openCommandWithQuery(rec.title)}
                      className="group w-32 shrink-0 text-left cursor-pointer"
                    >
                      <div className="aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
                        {rec.cover && (
                          <img
                            src={rec.cover}
                            alt={rec.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs font-medium text-zinc-300 group-hover:text-white">
                        {rec.title}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <MigrateModal open={migrateOpen} manga={manga} onClose={() => setMigrateOpen(false)} />
    </motion.div>
  );
}
