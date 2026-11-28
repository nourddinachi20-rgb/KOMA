import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { getProxiedImageUrl } from '../utils/api';
import { useT } from '../utils/i18n';
import { KomaLogo } from './KomaLogo';

const STAGE_PROGRESS = {
  hydrating: 22,
  engine: 55,
  warming: 84,
  ready: 100,
} as const;

const MIN_INTRO_MS = 2800;

export function SplashScreen() {
  const { bootStage, engineStatus, sources, homeHeroItems, homeRows, library, settings, syncSession } =
    useAppStore();
  const t = useT();
  const [ssdCovers, setSsdCovers] = useState<string[]>([]);
  const [minIntroDone, setMinIntroDone] = useState(false);
  const welcomeShownRef = useRef(false);

  const showingWelcome =
    bootStage !== 'hydrating' && !syncSession && !settings.hasSeenWelcome;
  if (showingWelcome) {
    welcomeShownRef.current = true;
  }

  useEffect(() => {
    void window.noctis
      .getSplashCovers()
      .then((urls) => {
        if (urls?.length) setSsdCovers(urls);
      })
      .catch(() => {});

    const timer = window.setTimeout(() => setMinIntroDone(true), MIN_INTRO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const coverPool = useMemo(() => {
    if (ssdCovers.length >= 12) return ssdCovers.slice(0, 18);
    const out: string[] = [...ssdCovers];
    const seen = new Set(out);

    if (engineStatus.url) {
      const mangaPool = [
        ...homeHeroItems,
        ...library.map((e) => e.manga),
        ...homeRows.flatMap((r) => r.items),
      ];
      for (const m of mangaPool) {
        if (out.length >= 18) break;
        const proxied = getProxiedImageUrl(engineStatus.url, m.source, m.coverUrl || m.largeCoverUrl);
        if (proxied && !seen.has(proxied)) {
          seen.add(proxied);
          out.push(proxied);
        }
      }
    }
    return out;
  }, [ssdCovers, engineStatus.url, homeHeroItems, homeRows, library]);

  // 3 clean marquee rows × 6 unique slots (duplicated once for seamless loop = 36 total GPU tiles, zero CSS filter shaders)
  const rows = useMemo(() => {
    const slotCount = 6;
    return [0, 1, 2].map((rowIdx) =>
      Array.from({ length: slotCount }, (_, colIdx) => {
        const idx = rowIdx * slotCount + colIdx;
        const src = coverPool.length > 0 ? coverPool[idx % coverPool.length] : null;
        return { key: `${rowIdx}-${colIdx}`, src };
      }),
    );
  }, [coverPool]);

  const engineDone = bootStage === 'ready';
  // If user came through the Welcome page, skip any extra timer delay and only finish remaining engine boot
  const visible = showingWelcome
    ? false
    : welcomeShownRef.current
      ? !engineDone
      : !(engineDone && minIntroDone);
  const progress = STAGE_PROGRESS[bootStage];
  const stageLabel = t.splash[bootStage];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="koma-splash"
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.035 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="keep-dark fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black text-white select-none"
        >
          {/* GPU-only angled drifting manga cover wall (zero CSS filter shaders per image) */}
          <div
            className="pointer-events-none absolute inset-[-18%] flex flex-col justify-center gap-4 -rotate-6"
            style={{ contain: 'layout style paint' }}
          >
            {rows.map((rowTiles, rowIdx) => {
              const duplicated = [...rowTiles, ...rowTiles];
              const animName = rowIdx === 1 ? 'koma-drift-right' : 'koma-drift-left';
              const duration = rowIdx === 1 ? '46s' : rowIdx === 0 ? '40s' : '50s';
              return (
                <div key={rowIdx} className="overflow-hidden">
                  <div
                    className="gpu-layer flex w-max gap-4"
                    style={{
                      animation: `${animName} ${duration} linear infinite`,
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    {duplicated.map((tile, tIdx) => (
                      <div
                        key={`${tile.key}-${tIdx}`}
                        className="h-52 w-36 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#08080C] sm:h-60 sm:w-40"
                      >
                        {tile.src ? (
                          <img
                            src={tile.src}
                            alt=""
                            decoding="async"
                            className="h-full w-full object-cover opacity-35"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-white/[0.06] via-transparent to-white/[0.02]" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monochrome OLED vignette + subtle accent halo */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 68% 62% at 50% 50%, rgba(4,4,7,0.62) 0%, rgba(2,2,4,0.88) 54%, #000000 92%)',
            }}
          />
          <div
            className="pointer-events-none absolute h-[460px] w-[460px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(var(--koma-accent-rgb), 0.14) 0%, rgba(var(--koma-accent-rgb), 0.03) 45%, transparent 72%)',
            }}
          />

          {/* Center Emblem + Wordmark Choreography */}
          <div className="relative z-10 flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.82, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/20 bg-[#08080C] shadow-[0_24px_80px_rgba(0,0,0,0.95)]"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.7, 0.25] }}
                transition={{ duration: 1.8, times: [0, 0.45, 1], ease: 'easeOut' }}
                className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/40"
              />
              <KomaLogo animated className="h-16 w-16" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 pl-[0.4em] text-3xl font-black tracking-[0.4em] text-white sm:text-4xl"
            >
              KOMA
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.48, ease: [0.22, 1, 0.36, 1] }}
              className="accent-pill mt-2.5 flex items-center gap-2 rounded-full border px-3.5 py-1"
            >
              <span className="font-mono-tech text-[10px] font-semibold uppercase tracking-[0.26em]">
                {t.splash.madeBy}
              </span>
            </motion.div>

            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.65, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 h-[1px] w-28 origin-center bg-gradient-to-r from-transparent via-white/55 to-transparent"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.7 }}
              className="mt-5 flex flex-col items-center"
            >
              <div className="h-[2.5px] w-60 overflow-hidden rounded-full bg-white/10">
                <div
                  style={{ width: `${progress}%`, backgroundColor: 'var(--koma-accent, #FFFFFF)' }}
                  className="h-full transition-[width] duration-500 ease-out"
                />
              </div>

              <div className="mt-3.5 flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--koma-accent, #FFFFFF)' }}
                />
                <span>{stageLabel}</span>
                {engineStatus.ready && sources.length > 0 && (
                  <span className="text-zinc-500">
                    · {settings.showNsfw ? sources.length : sources.filter((s) => s.contentType !== 'HENTAI').length}
                  </span>
                )}
              </div>
            </motion.div>

            {engineStatus.error && (
              <p className="mt-4 max-w-xs text-center text-xs text-rose-400">
                {engineStatus.error}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
