import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  FolderPlus,
  Layers,
  Play,
  Sparkles,
  Star,
} from 'lucide-react';
import { HOUR_MS, useAppStore } from '../store/useAppStore';
import { getProxiedImageUrl } from '../utils/api';
import { extractAmbientColor } from '../utils/colorExtractor';
import { MangaCard } from './MangaCard';

export function HomeView() {
  const {
    engineStatus,
    sources,
    history,
    library,
    settings,
    homeHeroItems,
    homeRows,
    detailsCache,
    loadHomeFeeds,
    openManga,
    openReader,
    toggleLibraryManga,
    setExploreSource,
    setActiveView,
    importLocalArchives,
  } = useAppStore();

  const [hourEpoch, setHourEpoch] = useState(() => Math.floor(Date.now() / HOUR_MS));
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [ambientRgb, setAmbientRgb] = useState('234, 194, 120');

  useEffect(() => {
    const checkHour = setInterval(() => {
      const nextEpoch = Math.floor(Date.now() / HOUR_MS);
      setHourEpoch((prev) => (prev !== nextEpoch ? nextEpoch : prev));
    }, 60_000);
    return () => clearInterval(checkHour);
  }, []);

  useEffect(() => {
    if (engineStatus.ready && sources.length > 0) {
      void loadHomeFeeds(hourEpoch, false);
    }
  }, [engineStatus.ready, sources.length, hourEpoch, loadHomeFeeds]);

  const fallbackHero = useMemo(() => {
    if (homeHeroItems.length > 0) return homeHeroItems;
    return library.slice(0, 8).map((l) => l.manga);
  }, [homeHeroItems, library]);

  const activeIdx = heroIndex % Math.max(1, fallbackHero.length);
  const rawHero = fallbackHero[activeIdx] ?? null;
  const currentHero = rawHero
    ? detailsCache[`${rawHero.source}::${rawHero.id}`] ?? rawHero
    : null;

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

  const cleanHeroDesc = currentHero?.description?.replace(/<[^>]+>/g, '').trim() ?? '';

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

      <div className="relative z-10 mx-auto max-w-[1460px] space-y-10 px-6 pt-3">
        {currentHero ? (
          <div
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
            className="relative overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#050508] shadow-[0_24px_70px_rgba(0,0,0,0.85)]"
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
                    {/* Compact cover badge shown on phones & portrait tablets */}
                    {heroCover && (
                      <div className="mb-4 flex items-center gap-4 lg:hidden">
                        <div
                          onClick={() => openManga(currentHero)}
                          className="w-24 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-zinc-950 shadow-xl cursor-pointer sm:w-28"
                          style={{ aspectRatio: '2/3' }}
                        >
                          <img
                            src={heroCover}
                            alt={currentHero.title}
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono-tech uppercase tracking-wider">
                            <span className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-white">
                              <Sparkles className="h-2.5 w-2.5 text-[#EAC278]" />
                              Spotlight
                            </span>
                            {currentHero.rating > 0 && (
                              <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-amber-300">
                                <Star className="h-2.5 w-2.5 fill-amber-300" />
                                {(currentHero.rating * 10).toFixed(1)}
                              </span>
                            )}
                          </div>
                          <h1 className="mt-2 line-clamp-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                            {currentHero.title}
                          </h1>
                          {currentHero.authors.length > 0 && (
                            <p className="mt-1 truncate text-xs text-zinc-300/90">
                              by {currentHero.authors.slice(0, 2).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="hidden lg:flex flex-wrap items-center gap-2 text-[11px] font-mono-tech uppercase tracking-[0.16em]">
                      <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white backdrop-blur-md">
                        <Sparkles className="h-3 w-3 text-[#EAC278]" />
                        Spotlight
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
                        <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-amber-300">
                          <Star className="h-3 w-3 fill-amber-300" />
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
                        by{' '}
                        <span className="font-medium text-white">
                          {currentHero.authors.slice(0, 2).join(', ')}
                        </span>
                      </p>
                    )}

                    {cleanHeroDesc && (
                      <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-relaxed text-zinc-300/85">
                        {cleanHeroDesc}
                      </p>
                    )}

                    {currentHero.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {currentHero.tags.slice(0, 5).map((t) => (
                          <span
                            key={t.key}
                            className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-zinc-200 backdrop-blur-md"
                          >
                            {t.title}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleQuickReadHero}
                        className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black shadow-[0_0_32px_rgba(255,255,255,0.3)] transition hover:scale-[1.03] hover:bg-zinc-100 cursor-pointer"
                      >
                        <Play className="h-4 w-4 fill-black" />
                        <span>Read Now</span>
                      </button>

                      <button
                        onClick={() => openManga(currentHero)}
                        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:border-white/30 hover:bg-white/[0.14] cursor-pointer"
                      >
                        <BookOpen className="h-4 w-4" />
                        <span>Details & Chapters</span>
                      </button>

                      <button
                        onClick={() => toggleLibraryManga(currentHero)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition cursor-pointer ${
                          heroInLibrary
                            ? 'border-white/40 bg-white text-black'
                            : 'border-white/15 bg-white/[0.07] text-white hover:border-white/30 hover:bg-white/[0.14]'
                        }`}
                        title={heroInLibrary ? 'In Library' : 'Add to Library'}
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

            {fallbackHero.length > 1 && (
              <div className="relative z-20 border-t border-white/[0.08] bg-black/75">
                {/* Synchronized Hero Advance Bar: switches to next spotlight once filled */}
                <div className="h-[3px] w-full overflow-hidden bg-white/[0.06]">
                  <div
                    key={`advance-${activeIdx}-${fallbackHero.length}`}
                    onAnimationEnd={() => setHeroIndex((i) => (i + 1) % fallbackHero.length)}
                    style={{
                      animation: 'hero-advance 8500ms linear forwards',
                      animationPlayState: heroPaused ? 'paused' : 'running',
                    }}
                    className="h-full w-full origin-left bg-gradient-to-r from-[#EAC278] via-white to-[#EAC278] shadow-[0_0_10px_rgba(234,194,120,0.6)]"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 px-6 py-3">
                  <div className="flex flex-1 items-center gap-2 overflow-x-auto no-scrollbar">
                  {fallbackHero.map((item, idx) => {
                    const active = idx === activeIdx;
                    const thumb = getProxiedImageUrl(
                      engineStatus.url,
                      item.source,
                      item.coverUrl || item.largeCoverUrl,
                    );
                    return (
                      <button
                        key={`${item.source}-${item.id}`}
                        onClick={() => setHeroIndex(idx)}
                        className={`group flex shrink-0 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition cursor-pointer ${
                          active
                            ? 'border-white/30 bg-white/15 text-white'
                            : 'border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:text-zinc-200'
                        }`}
                      >
                        <div className="h-8 w-6 shrink-0 overflow-hidden rounded bg-zinc-900">
                          {thumb && (
                            <img
                              src={thumb}
                              alt=""
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <span className="max-w-[125px] truncate text-xs font-medium">
                          {item.title}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() =>
                      setHeroIndex((activeIdx - 1 + fallbackHero.length) % fallbackHero.length)
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-zinc-300 transition hover:border-white/30 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setHeroIndex((activeIdx + 1) % fallbackHero.length)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-zinc-300 transition hover:border-white/30 hover:text-white cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[340px] flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
            <h1 className="font-editorial text-4xl text-white">Your KOMA Sanctuary Awaits</h1>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              {engineStatus.ready
                ? 'Loading live feeds from Manga Ball, MangaDex, and your verified sources...'
                : 'Connecting to your bundled manga engine...'}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setActiveView('explore')}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black cursor-pointer"
              >
                <Compass className="h-3.5 w-3.5" />
                Browse Sources
              </button>
              <button
                onClick={importLocalArchives}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2 text-xs font-medium text-white cursor-pointer"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Import CBZ
              </button>
            </div>
          </div>
        )}

        {/* Continue Reading Row */}
        {history.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-white">Continue Reading</h2>
            </div>
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
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
                <span>Explore</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            {row.loading && row.items.length === 0 ? (
              <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[2/3] w-[156px] shrink-0 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                  />
                ))}
              </div>
            ) : row.items.length > 0 ? (
              <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                {row.items.map((item) => (
                  <MangaCard key={`${row.source}-${item.id}`} manga={item} compact />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-xs text-zinc-500">
                {row.subtitle} did not respond right now — try switching sources in Explore or Sources.
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
