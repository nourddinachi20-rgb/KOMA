import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { useT } from '../utils/i18n';

const STAGE_PROGRESS = {
  hydrating: 22,
  engine: 55,
  warming: 84,
  ready: 100,
} as const;

const MIN_INTRO_MS = 1400;

const BUNDLED_SPLASH_COVERS = Array.from(
  { length: 12 },
  (_, idx) => `./splash/tile-${idx + 1}.jpg`,
);

// 3 static marquee rows built from 12 lightweight (240x360) bundled local covers
const SPLASH_ROWS = [0, 1, 2].map((rowIdx) => {
  const rowTiles = Array.from({ length: 6 }, (_, colIdx) => {
    const src = BUNDLED_SPLASH_COVERS[(rowIdx * 4 + colIdx) % BUNDLED_SPLASH_COVERS.length];
    return { key: `${rowIdx}-${colIdx}`, src };
  });
  return {
    key: rowIdx,
    animName: rowIdx === 1 ? 'koma-drift-right' : 'koma-drift-left',
    duration: rowIdx === 1 ? '48s' : rowIdx === 0 ? '42s' : '54s',
    tiles: [...rowTiles, ...rowTiles],
  };
});

export function SplashScreen() {
  const bootStage = useAppStore((s) => s.bootStage);
  const engineReady = useAppStore((s) => s.engineStatus.ready);
  const engineError = useAppStore((s) => s.engineStatus.error);
  const sourcesCount = useAppStore((s) =>
    s.settings.showNsfw
      ? s.sources.length
      : s.sources.filter((src) => src.contentType !== 'HENTAI').length,
  );
  const hasSeenWelcome = useAppStore((s) => s.settings.hasSeenWelcome);
  const hasSyncSession = useAppStore((s) => Boolean(s.syncSession));

  const t = useT();
  const [minIntroDone, setMinIntroDone] = useState(false);
  const welcomeShownRef = useRef(false);

  const showingWelcome = bootStage !== 'hydrating' && !hasSyncSession && !hasSeenWelcome;
  if (showingWelcome) {
    welcomeShownRef.current = true;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setMinIntroDone(true), MIN_INTRO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const engineDone = bootStage === 'ready';
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
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="keep-dark fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black text-white select-none"
        >
          <div
            className="pointer-events-none absolute inset-[-18%] flex flex-col justify-center gap-4 -rotate-6"
            style={{ contain: 'strict', transform: 'translateZ(0)' }}
          >
            {SPLASH_ROWS.map((row) => (
              <div key={row.key} className="overflow-hidden">
                <div
                  className="gpu-layer flex w-max gap-4"
                  style={{
                    animation: `${row.animName} ${row.duration} linear infinite`,
                    backfaceVisibility: 'hidden',
                    willChange: 'transform',
                  }}
                >
                  {row.tiles.map((tile, tIdx) => (
                    <div
                      key={`${tile.key}-${tIdx}`}
                      className="h-52 w-36 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#08080C] sm:h-60 sm:w-40"
                    >
                      <img
                        src={tile.src}
                        alt=""
                        loading="eager"
                        decoding="async"
                        className="h-full w-full object-cover opacity-35"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 68% 62% at 50% 50%, rgba(4,4,7,0.62) 0%, rgba(2,2,4,0.88) 54%, #000000 92%)',
            }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <div className="pl-[0.4em] text-4xl font-black tracking-[0.4em] text-white sm:text-5xl">
              KOMA
            </div>

            <div className="mt-6 flex flex-col items-center">
              <div className="h-[2.5px] w-56 overflow-hidden rounded-full bg-white/10">
                <div
                  style={{ width: `${progress}%`, backgroundColor: 'var(--koma-accent, #FFFFFF)' }}
                  className="h-full transition-[width] duration-400 ease-out"
                />
              </div>

              <div className="mt-3.5 flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--koma-accent, #FFFFFF)' }}
                />
                <span>{stageLabel}</span>
                {engineReady && sourcesCount > 0 && (
                  <span className="text-zinc-500">· {sourcesCount}</span>
                )}
              </div>
            </div>

            {engineError && (
              <p className="mt-4 max-w-xs text-center text-xs text-rose-400">
                {engineError}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
