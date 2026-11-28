import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  Compass,
  FolderPlus,
  Layers,
  Play,
  Sparkles,
  Star,
} from 'lucide-react';
import type { AniListMediaInfo } from '../types';
import { HOUR_MS, useAppStore } from '../store/useAppStore';
import { cleanDescriptionMarkup, getProxiedImageUrl } from '../utils/api';
import { extractAmbientColor } from '../utils/colorExtractor';
import { useT } from '../utils/i18n';
import { MangaCard } from './MangaCard';

export function HomeView() {
  const {
    engineStatus,
    sources,
    history,
    library,
    syncSession,
    settings,
    homeHeroItems,
    homeRows,
    detailsCache,
    loadHomeFeeds,
    prefetchMangaDetails,
    openManga,
    openReader,
    toggleLibraryManga,
    setExploreSource,
    setActiveView,
    importLocalArchives,
  } = useAppStore();

  const t = useT();
  const [hourEpoch, setHourEpoch] = useState(() => Math.floor(Date.now() / HOUR_MS));
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [ambientRgb, setAmbientRgb] = useState('255, 255, 255');
  const [aniHeroMeta, setAniHeroMeta] = useState<Record<string, AniListMediaInfo | null>>({});
  const aniRequestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkHour = setInterval(() => {
      const nextEpoch = Math.floor(Date.now() / HOUR_MS);
      setHourEpoch((prev) => (prev !== nextEpoch ? nextEpoch : prev));
    }, 60_000);
    return () => clearInterval(checkHour);
  }, []);

  useEffect(() => {
    const canFetch = Boolean(settings.hasSeenWelcome || syncSession);
    if (canFetch && engineStatus.ready && sources.length > 0) {
      void loadHomeFeeds(hourEpoch, false);
    }
  }, [settings.hasSeenWelcome, syncSession, engineStatus.ready, sources.length, hourEpoch, loadHomeFeeds]);

  const fallbackHero = useMemo(() => {
    if (homeHeroItems.length > 0) return homeHeroItems;
    return library.slice(0, 8).map((l) => l.manga);
  }, [homeHeroItems, library]);

  useEffect(() => {
    if (heroPaused || fallbackHero.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % fallbackHero.length);
    }, 8500);
    return () => window.clearInterval(timer);
  }, [heroPaused, fallbackHero.length]);

  const activeIdx = heroIndex % Math.max(1, fallbackHero.length);
  const rawHero = fallbackHero[activeIdx] ?? null;
  const currentHeroKey = rawHero ? `${rawHero.source}::${rawHero.id}` : '';
  const currentHero = rawHero
    ? detailsCache[currentHeroKey] ?? rawHero
    : null;

  useEffect(() => {
    if (!engineStatus.ready || !rawHero) return;
    if (!detailsCache[currentHeroKey] || detailsCache[currentHeroKey]?.chapters === null) {
      void prefetchMangaDetails(rawHero);
    }
    const upcomingHero =
      fallbackHero.length > 1 ? fallbackHero[(activeIdx + 1) % fallbackHero.length] : null;
    if (upcomingHero) {
      const nextKey = `${upcomingHero.source}::${upcomingHero.id}`;
      if (!detailsCache[nextKey]) void prefetchMangaDetails(upcomingHero);
    }
  }, [engineStatus.ready, rawHero, currentHeroKey, detailsCache, fallbackHero, activeIdx, prefetchMangaDetails]);

  useEffect(() => {
    if (!currentHero || !currentHeroKey) return;
    const hasDesc = Boolean(cleanDescriptionMarkup(currentHero.description));
    const hasTags = currentHero.tags.length > 0;
    if ((hasDesc && hasTags) || aniRequestedRef.current.has(currentHeroKey)) return;
    aniRequestedRef.current.add(currentHeroKey);
    const keyForReq = currentHeroKey;
    void window.noctis
      .fetchAniListMetadata(currentHero.title, currentHero.altTitles?.[0])
      .then((meta) => {
        setAniHeroMeta((prev) => ({ ...prev, [keyForReq]: meta }));
      })
      .catch(() => {});
  }, [currentHero, currentHeroKey]);

  useEffect(() => {
    if (!currentHero || !settings.ambientGlow) return;
    const cover = getProxiedImageUrl(
      engineStatus.url,
      currentHero.source,
      currentHero.coverUrl || currentHero.largeCoverUrl,
    );
    if (cover) extractAmbientColor(cover).then(setAmbientRgb);
  }, [currentHero, engineStatus.url, settings.ambientGlow]);

  const heroCover = currentHero
    ? getProxiedImageUrl(
        engineStatus.url,
        currentHero.source,
        currentHero.largeCoverUrl || currentHero.coverUrl,
      )
    : '';

  const heroBackdropThumb = currentHero
    ? getProxiedImageUrl(
        engineStatus.url,
        currentHero.source,
        currentHero.coverUrl || currentHero.largeCoverUrl,
      )
    : '';

  const prevHero =
    fallbackHero.length > 1
      ? fallbackHero[(activeIdx - 1 + fallbackHero.length) % fallbackHero.length]
      : null;
  const nextHero =
    fallbackHero.length > 1 ? fallbackHero[(activeIdx + 1) % fallbackHero.length] : null;
  const prevHeroCover = prevHero
    ? getProxiedImageUrl(
        engineStatus.url,
        prevHero.source,
        prevHero.coverUrl || prevHero.largeCoverUrl,
      )
    : '';
  const nextHeroCover = nextHero
    ? getProxiedImageUrl(
        engineStatus.url,
        nextHero.source,
        nextHero.coverUrl || nextHero.largeCoverUrl,
      )
    : '';

  const heroInLibrary = currentHero
    ? library.some((e) => e.key === `${currentHero.source}::${currentHero.id}`)
    : false;

  const handleQuickReadHero = () => {
    if (!currentHero) return;
    if (currentHero.chapters && currentHero.chapters.length > 0) {
      openReader({
        manga: currentHero,
        chapters: currentHero.chapters,
        chapterIndex: 0,
      });
    } else {
      openManga(currentHero);
    }
  };

  const activeAniMeta = currentHeroKey ? aniHeroMeta[currentHeroKey] ?? null : null;
  const cleanHeroDesc =
    cleanDescriptionMarkup(currentHero?.description) ||
    cleanDescriptionMarkup(activeAniMeta?.description);
  const heroGenres =
    currentHero && currentHero.tags.length > 0
      ? currentHero.tags
      : (activeAniMeta?.genres ?? []).map((g) => ({
          title: g,
          key: g.toLowerCase().replace(/\s+/g, '-'),
          source: currentHero?.source ?? 'ANILIST',
        }));

  return (
    <div className="relative h-full w-full overflow-y-auto pb-20">
      {/* Zero-blur pure CSS radial ambient glow */}
      {settings.ambientGlow && (
        <div
          className="pointer-events-none fixed left-1/2 top-0 h-[520px] w-[1080px] -translate-x-1/2 transition-colors duration-700"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, rgba(${ambientRgb}, 0.22) 0%, rgba(${ambientRgb}, 0.06) 45%, transparent 72%)`,
          }}
        />
      )}

      <div className="relative z-10 mx-auto max-w-[1460px] space-y-8 px-4 pt-3 sm:space-y-10 sm:px-6">
        {currentHero ? (
          <div
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
            className="keep-dark relative overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#050508] shadow-[0_24px_70px_rgba(0,0,0,0.85)]"
          >
            {heroBackdropThumb && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <img
                  src={heroBackdropThumb}
                  alt=""
                  decoding="async"
                  className="h-full w-full object-cover object-center opacity-20 blur-md scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#040406] via-[#040406]/85 to-black/35" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#040406] via-transparent to-black/40" />
                <div
                  className="absolute right-[4%] top-1/2 h-[420px] w-[420px] -translate-y-1/2"
                  style={{
                    background: `radial-gradient(circle, rgba(${ambientRgb}, 0.34) 0%, rgba(${ambientRgb}, 0.08) 50%, transparent 72%)`,
                  }}
                />
              </div>
            )}

            <div className="relative z-10 grid min-h-[340px] grid-cols-1 items-center gap-6 p-5 sm:p-8 lg:min-h-[430px] lg:gap-8 lg:p-10 lg:grid-cols-12">
              <div className="lg:col-span-6 xl:col-span-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentHero.source}-${currentHero.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                  >
                    {/* Top part on phones & portrait tablets: cover left, title / author / genres right */}
                    <div className="mb-3 flex items-start gap-4 lg:hidden">
                      <div
                        onClick={() => openManga(currentHero)}
                        className="w-24 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-zinc-950 shadow-xl cursor-pointer sm:w-28"
                        style={{ aspectRatio: '2/3' }}
                      >
                        {heroCover ? (
                          <img
                            src={heroCover}
                            alt={currentHero.title}
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-700">
                            <BookOpen className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono-tech uppercase tracking-wider">
                          <span className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-white">
                            <Sparkles className="h-2.5 w-2.5 accent-fg" />
                            {t.home.spotlight}
                          </span>
                          {currentHero.rating > 0 && (
                            <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-zinc-200">
                              <Star className="h-2.5 w-2.5 fill-white text-white" />
                              {(currentHero.rating * 10).toFixed(1)}
                            </span>
                          )}
                        </div>
                        <h1 className="mt-1.5 line-clamp-2 text-xl font-extrabold tracking-tight text-white sm:text-3xl">
                          {currentHero.title}
                        </h1>
                        {currentHero.authors.length > 0 && (
                          <p className="mt-1 truncate text-xs text-zinc-300/90">
                            {t.home.by} {currentHero.authors.slice(0, 2).join(', ')}
                          </p>
                        )}
                        {heroGenres.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {heroGenres.slice(0, 4).map((tag) => (
                              <span
                                key={tag.key}
                                className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-200 backdrop-blur-md"
                              >
                                {tag.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="hidden lg:flex flex-wrap items-center gap-2 text-[11px] font-mono-tech uppercase tracking-[0.16em]">
                      <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white backdrop-blur-md">
                        <Sparkles className="h-3 w-3 accent-fg" />
                        {t.home.spotlight}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-zinc-300">
                        {currentHero.source.replace(/_/g, ' ')}
                      </span>
                      {currentHero.state && (
                        <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-zinc-300">
                          {currentHero.state}
                        </span>
                      )}
                      {currentHero.rating > 0 && (
                        <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-zinc-200">
                          <Star className="h-3 w-3 fill-white text-white" />
                          {(currentHero.rating * 10).toFixed(1)}
                        </span>
                      )}
                      {currentHero.chapters && currentHero.chapters.length > 0 && (
                        <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-zinc-200">
                          <Layers className="h-3 w-3 text-zinc-400" />
                          {currentHero.chapters.length} Ch
                        </span>
                      )}
                    </div>

                    <h1 className="hidden lg:block mt-4 line-clamp-2 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                      {currentHero.title}
                    </h1>

                    {currentHero.authors.length > 0 && (
                      <p className="hidden lg:block mt-1.5 text-sm text-zinc-300/90">
                        {t.home.by}{' '}
                        <span className="font-medium text-white">
                          {currentHero.authors.slice(0, 2).join(', ')}
                        </span>
                      </p>
                    )}

                    {heroGenres.length > 0 && (
                      <div className="hidden lg:flex mt-2.5 flex-wrap gap-1.5">
                        {heroGenres.slice(0, 5).map((tag) => (
                          <span
                            key={tag.key}
                            className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-zinc-200 backdrop-blur-md"
                          >
                            {tag.title}
                          </span>
                        ))}
                      </div>
                    )}

                    {cleanHeroDesc && (
                      <p className="mt-3 max-w-xl line-clamp-3 text-xs sm:text-sm leading-relaxed text-zinc-300/85">
                        {cleanHeroDesc}
                      </p>
                    )}

                    <div className="mt-4 sm:mt-5 flex flex-nowrap items-center gap-2 sm:gap-3">
                      <button
                        onClick={handleQuickReadHero}
                        className="accent-bg flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-full px-4 py-2.5 sm:px-6 text-xs sm:text-sm font-semibold whitespace-nowrap shadow-[0_0_28px_rgba(var(--koma-accent-rgb),0.22)] transition hover:scale-[1.03] cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
                        <span>{t.home.readNow}</span>
                      </button>

                      <button
                        onClick={() => openManga(currentHero)}
                        className="flex min-w-0 items-center gap-1.5 sm:gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-2.5 sm:px-5 text-xs sm:text-sm font-medium text-white backdrop-blur-md transition hover:border-white/30 hover:bg-white/[0.14] cursor-pointer"
                      >
                        <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">{t.home.details}</span>
                      </button>

                      <button
                        onClick={() => toggleLibraryManga(currentHero)}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border backdrop-blur-md transition cursor-pointer ${
                          heroInLibrary
                            ? 'accent-bg border-white/40'
                            : 'border-white/15 bg-white/[0.07] text-white hover:border-white/30 hover:bg-white/[0.14]'
                        }`}
                        title={heroInLibrary ? t.home.inLibrary : t.home.addToLibrary}
                      >
                        {heroInLibrary ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Bookmark className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Right Interactive 3-Card Perspective Showcase Stage */}
              <div className="relative hidden lg:col-span-6 lg:flex items-center justify-center h-[350px]">
                {prevHero && (
                  <motion.div
                    key={`prev-${prevHero.source}-${prevHero.id}`}
                    onClick={() =>
                      setHeroIndex((activeIdx - 1 + fallbackHero.length) % fallbackHero.length)
                    }
                    whileHover={{ scale: 0.88, x: -165 }}
                    animate={{ scale: 0.84, x: -155, rotate: -6, opacity: 0.55 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    className="gpu-layer absolute z-10 w-44 cursor-pointer overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl"
                    style={{ aspectRatio: '2/3' }}
                  >
                    {prevHeroCover && (
                      <img
                        src={prevHeroCover}
                        alt={prevHero.title}
                        decoding="async"
                        className="h-full w-full object-cover brightness-75"
                      />
                    )}
                  </motion.div>
                )}

                {nextHero && (
                  <motion.div
                    key={`next-${nextHero.source}-${nextHero.id}`}
                    onClick={() => setHeroIndex((activeIdx + 1) % fallbackHero.length)}
                    whileHover={{ scale: 0.88, x: 165 }}
                    animate={{ scale: 0.84, x: 155, rotate: 6, opacity: 0.55 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    className="gpu-layer absolute z-10 w-44 cursor-pointer overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl"
                    style={{ aspectRatio: '2/3' }}
                  >
                    {nextHeroCover && (
                      <img
                        src={nextHeroCover}
                        alt={nextHero.title}
                        decoding="async"
                        className="h-full w-full object-cover brightness-75"
                      />
                    )}
                  </motion.div>
                )}

                <motion.div
                  key={`center-${currentHero.source}-${currentHero.id}`}
                  initial={{ opacity: 0, scale: 0.92, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  whileHover={{ scale: 1.03, y: -4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  onClick={() => openManga(currentHero)}
                  className="gpu-layer relative z-20 w-56 cursor-pointer overflow-hidden rounded-2xl border border-white/25 bg-zinc-950 shadow-[0_28px_70px_rgba(0,0,0,0.95)]"
                  style={{ aspectRatio: '2/3' }}
                >
                  {heroCover && (
                    <img
                      src={heroCover}
                      alt={currentHero.title}
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20" />
                </motion.div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[340px] flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
            <h1 className="text-3xl font-bold text-white">{t.home.loadingTitle}</h1>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              {engineStatus.ready ? t.home.loadingSources : t.home.connectingEngine}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setActiveView('explore')}
                className="accent-bg flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold cursor-pointer"
              >
                <Compass className="h-3.5 w-3.5" />
                {t.home.browseSources}
              </button>
              <button
                onClick={importLocalArchives}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2 text-xs font-medium text-white cursor-pointer"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                {t.home.importCbz}
              </button>
            </div>
          </div>
        )}

        {/* Continue Reading Row */}
        {history.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                {t.home.continueReading}
              </h2>
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:gap-4">
              {history.slice(0, 16).map((h) => {
                const pct =
                  h.totalPages > 0 ? Math.round(((h.pageIndex + 1) / h.totalPages) * 100) : 10;
                return (
                  <MangaCard
                    key={h.key}
                    manga={h.manga}
                    compact
                    subtitle={`Ch. ${h.chapterNumber || '?'} · p.${h.pageIndex + 1}/${h.totalPages || '?'}`}
                    progressPercent={pct}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Live Source Rows */}
        {homeRows.map((row) => (
          <section key={row.source}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-white">{row.title}</h2>
              <button
                onClick={() => setExploreSource(row.source)}
                className="group flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/25 hover:text-white cursor-pointer"
              >
                <span>{t.home.explore}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            {row.loading && row.items.length === 0 ? (
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[2/3] w-[156px] shrink-0 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                  />
                ))}
              </div>
            ) : row.items.length > 0 ? (
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:gap-4">
                {row.items.map((item) => (
                  <MangaCard key={`${row.source}-${item.id}`} manga={item} compact />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-xs text-zinc-500">
                {row.subtitle} {t.home.sourceNoResponse}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
