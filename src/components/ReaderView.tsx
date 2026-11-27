import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Contrast,
  Eye,
  EyeOff,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  MoveVertical,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { FitMode, ReaderMode } from '../types';
import { useT } from '../utils/i18n';

function ResilientReaderImage({
  src,
  alt,
  loading,
  className,
}: {
  src: string;
  alt: string;
  loading?: 'eager' | 'lazy';
  className: string;
}) {
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setRetry(0);
    setFailed(false);
  }, [src]);

  const effectiveSrc =
    retry > 0 && src.includes('/api/image?') ? `${src}&r=${retry}` : src;

  const handleError = () => {
    if (retry < 2) {
      setTimeout(() => setRetry((r) => r + 1), 800 * (retry + 1));
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setFailed(false);
          setRetry((r) => r + 1);
        }}
        className="flex min-h-[320px] w-full max-w-[700px] flex-col items-center justify-center gap-2 border border-white/10 bg-white/[0.03] px-6 py-12 text-xs text-zinc-400 hover:bg-white/[0.06] cursor-pointer"
      >
        <RotateCcw className="h-5 w-5 text-zinc-300" />
        <span>Failed to load {alt} — Tap to reload</span>
      </button>
    );
  }

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      draggable={false}
      onError={handleError}
      className={className}
    />
  );
}

export function ReaderView() {
  const t = useT();
  const {
    readerSession,
    closeReader,
    engineStatus,
    settings,
    updateSettings,
    recordHistory,
    prefetchChapterPages,
    markChapterRead,
    library,
    recordReadingPulse,
  } = useAppStore();

  const [chapterIndex, setChapterIndex] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [mode, setMode] = useState<ReaderMode>(settings.defaultReaderMode);
  const [fit, setFit] = useState<FitMode>(settings.defaultFitMode);
  const [hudVisible, setHudVisible] = useState(false);
  const [showDisplayPanel, setShowDisplayPanel] = useState(false);
  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');
  const [hoverPagePreview, setHoverPagePreview] = useState<{ page: number; pct: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Zoom, Pan & Auto-Scroll states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const decodedCacheRef = useRef<Set<string>>(new Set());
  const completedChapterIdsRef = useRef<Set<string>>(new Set());
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const bingeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!readerSession) return;
    const mKey = `${readerSession.manga.source}::${readerSession.manga.id}`;
    const savedPref = settings.mangaReaderPrefs?.[mKey];
    const tagsLower = readerSession.manga.tags.map((t) => t.title.toLowerCase());
    const srcUpper = readerSession.manga.source.toUpperCase();
    const titleSample = `${readerSession.manga.title} ${readerSession.manga.altTitles.join(' ')}`;
    const hasKoreanOrManhwaScript = /[\uAC00-\uD7AF]/.test(titleSample);
    const looksWebtoon =
      tagsLower.some((t) =>
        ['long strip', 'web comic', 'webtoon', 'full color', 'manhwa', 'manhua', 'vertical'].some(
          (k) => t.includes(k),
        ),
      ) ||
      ['ASURA', 'REAPER', 'FLAME', 'LEVIATAN', 'WEBTOON', 'MANHWA'].some((k) =>
        srcUpper.includes(k),
      ) ||
      hasKoreanOrManhwaScript;
    const detectedMode: ReaderMode =
      savedPref?.mode ?? (looksWebtoon ? 'webtoon' : 'rtl');
    const detectedFit: FitMode = savedPref?.fit ?? settings.defaultFitMode;

    setMode(detectedMode);
    setFit(detectedFit);
    setChapterIndex(readerSession.chapterIndex);
    setCurrentPage(readerSession.initialPage ?? 0);
    setHudVisible(false);
    setChapterDrawerOpen(false);
    setChapterSearch('');
    setHoverPagePreview(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setAutoScroll(false);
    if (bingeTimerRef.current) {
      window.clearTimeout(bingeTimerRef.current);
      bingeTimerRef.current = null;
    }
  }, [readerSession]);

  const manga = readerSession?.manga ?? null;
  const chapters = readerSession?.chapters ?? [];
  const chapter = chapters[chapterIndex] ?? null;
  const readChapterIds = useMemo(() => {
    if (!manga) return new Set<string>();
    const entry = library.find((e) => e.key === `${manga.source}::${manga.id}`);
    return new Set<string>(entry?.readChapterIds ?? []);
  }, [manga, library]);

  // Update Discord Rich Presence when reading a chapter
  useEffect(() => {
    if (!manga || !chapter || !settings.discordRpc) return;
    const label = chapter.number > 0 ? `Chapter ${chapter.number}` : chapter.title || 'Reading';
    void window.noctis.setDiscordReading(manga.title, label);
  }, [manga, chapter, settings.discordRpc]);

  // Load chapter pages (from cache / offline CBZ / live engine)
  useEffect(() => {
    if (!manga || !chapter) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    prefetchChapterPages(chapter)
      .then((urls) => {
        if (cancelled) return;
        if (urls.length === 0) {
          throw new Error('No pages returned for this chapter');
        }
        setPages(urls);
        const startPage =
          readerSession && chapterIndex === readerSession.chapterIndex
            ? Math.min(readerSession.initialPage ?? 0, Math.max(0, urls.length - 1))
            : 0;
        setCurrentPage(startPage);

        // Live aspect-ratio auto-detection when user hasn't pinned a mode for this series
        const mKey = `${manga.source}::${manga.id}`;
        const hasManualPref = Boolean(settings.mangaReaderPrefs?.[mKey]?.mode);
        if (!hasManualPref && urls.length > 0) {
          Promise.all(
            urls.slice(0, 3).map(
              (u) =>
                new Promise<{ w: number; h: number } | null>((res) => {
                  const im = new Image();
                  im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
                  im.onerror = () => res(null);
                  im.src = u;
                }),
            ),
          ).then((dims) => {
            if (cancelled) return;
            const valid = dims.filter((d): d is { w: number; h: number } => Boolean(d && d.w > 0 && d.h > 0));
            if (valid.length === 0) return;
            const avgRatio = valid.reduce((acc, d) => acc + d.h / d.w, 0) / valid.length;
            const wideVerticalCount = valid.filter((d) => d.h / d.w >= 1.85).length;
            if (wideVerticalCount >= 1 || avgRatio >= 1.85) {
              setMode('webtoon');
            } else if (avgRatio <= 1.6) {
              setMode('rtl');
            }
          });
        }

        if (mode === 'webtoon' && startPage > 0) {
          requestAnimationFrame(() => {
            pageRefs.current[startPage]?.scrollIntoView({ behavior: 'auto' });
          });
        }
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
  }, [manga, chapter, engineStatus.ready, engineStatus.url, prefetchChapterPages]);

  // Preload + GPU-decode upcoming pages, and prefetch next chapter when near the end
  useEffect(() => {
    if (pages.length === 0) return;
    const count = settings.preloadCount || 4;
    for (let i = 0; i <= count; i++) {
      const idx = currentPage + i;
      if (idx < pages.length) {
        const src = pages[idx];
        if (!decodedCacheRef.current.has(src)) {
          decodedCacheRef.current.add(src);
          const img = new Image();
          img.src = src;
          void img.decode().catch(() => {});
        }
      }
    }

    const nextCh = chapters[chapterIndex + 1];
    if (nextCh && currentPage >= Math.max(0, pages.length - 3)) {
      void prefetchChapterPages(nextCh).then((nextUrls) => {
        for (const u of nextUrls.slice(0, 3)) {
          if (!decodedCacheRef.current.has(u)) {
            decodedCacheRef.current.add(u);
            const img = new Image();
            img.src = u;
            void img.decode().catch(() => {});
          }
        }
      });
    }
  }, [currentPage, pages, settings.preloadCount, chapters, chapterIndex, prefetchChapterPages]);

  // Auto-mark chapter read + record Sanctuary stats when >= 85% through a chapter
  useEffect(() => {
    if (!manga || !chapter || pages.length === 0) return;
    const threshold = Math.max(0, Math.floor(pages.length * 0.85));
    if (currentPage >= threshold && !completedChapterIdsRef.current.has(chapter.id)) {
      completedChapterIdsRef.current.add(chapter.id);
      void markChapterRead(manga, chapter.id, true, chapter.number);
      void recordReadingPulse(
        pages.length,
        true,
        manga.tags.map((t) => t.title),
      );
    }
  }, [manga, chapter, currentPage, pages.length, markChapterRead, recordReadingPulse]);

  // Hands-free Webtoon Auto-Scroll (Cruise Mode)
  useEffect(() => {
    if (!autoScroll || mode !== 'webtoon') return;
    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(60, now - lastTs);
      lastTs = now;
      const el = scrollContainerRef.current;
      if (el) {
        const pxPerSec = 55 * (settings.autoScrollSpeed || 2);
        el.scrollTop += (pxPerSec * dt) / 1000;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [autoScroll, mode, settings.autoScrollSpeed]);

  // IntersectionObserver for zero-overhead Webtoon page tracking
  useEffect(() => {
    if (mode !== 'webtoon' || pages.length === 0) return;
    const root = scrollContainerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIdx = -1;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= bestRatio) {
            const idxAttr = entry.target.getAttribute('data-page-idx');
            if (idxAttr !== null) {
              bestRatio = entry.intersectionRatio;
              bestIdx = Number(idxAttr);
            }
          }
        }
        if (bestIdx >= 0) {
          setCurrentPage(bestIdx);
        }
      },
      { root, threshold: [0.2, 0.5, 0.8] },
    );

    for (const el of pageRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [mode, pages]);

  // Persist reading progress debounced
  useEffect(() => {
    if (!manga || !chapter || pages.length === 0) return;
    const t = setTimeout(() => {
      void recordHistory({
        key: `${manga.source}::${manga.id}`,
        manga,
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title || `Chapter ${chapter.number || ''}`,
        pageIndex: currentPage,
        totalPages: pages.length,
        updatedAt: Date.now(),
      });
    }, 450);
    return () => clearTimeout(t);
  }, [manga, chapter, currentPage, pages.length, recordHistory]);

  const goNextPage = useCallback(() => {
    if (pages.length === 0) return;
    const step = mode === 'double' ? 2 : 1;
    if (currentPage + step < pages.length) {
      setCurrentPage((p) => Math.min(pages.length - 1, p + step));
    } else if (chapterIndex + 1 < chapters.length) {
      setChapterIndex((i) => i + 1);
      setCurrentPage(0);
    }
  }, [pages.length, mode, currentPage, chapterIndex, chapters.length]);

  const goPrevPage = useCallback(() => {
    const step = mode === 'double' ? 2 : 1;
    if (currentPage - step >= 0) {
      setCurrentPage((p) => Math.max(0, p - step));
    } else if (chapterIndex > 0) {
      setChapterIndex((i) => i - 1);
      setCurrentPage(0);
    }
  }, [mode, currentPage, chapterIndex]);

  useEffect(() => {
    if (!readerSession) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (chapterDrawerOpen) {
          setChapterDrawerOpen(false);
          return;
        }
        closeReader();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        window.noctis.toggleFullscreen().then(setIsFullscreen);
      } else if (e.key === 'h' || e.key === 'H') {
        setHudVisible((v) => !v);
      } else if (e.key === 'c' || e.key === 'C') {
        setChapterDrawerOpen((o) => !o);
      } else if (e.key === 'a' || e.key === 'A') {
        if (mode === 'webtoon') setAutoScroll((s) => !s);
      } else if (e.key === ' ' && mode === 'webtoon') {
        e.preventDefault();
        setAutoScroll((s) => !s);
      } else if (e.key === '=' || e.key === '+') {
        setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)));
      } else if (e.key === '-') {
        setZoom((z) => {
          const next = Math.max(1, +(z - 0.2).toFixed(2));
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else if (e.key === '[') {
        if (chapterIndex > 0) {
          setChapterIndex((i) => i - 1);
          setCurrentPage(0);
        }
      } else if (e.key === ']') {
        if (chapterIndex + 1 < chapters.length) {
          setChapterIndex((i) => i + 1);
          setCurrentPage(0);
        }
      } else if (mode !== 'webtoon') {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          mode === 'rtl' ? goPrevPage() : goNextPage();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          mode === 'rtl' ? goNextPage() : goPrevPage();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readerSession, chapterDrawerOpen, mode, chapterIndex, chapters.length, goNextPage, goPrevPage, closeReader]);

  const handleWebtoonScroll = () => {
    if (hudVisible && !showDisplayPanel) {
      setHudVisible(false);
    }
    const el = scrollContainerRef.current;
    if (
      el &&
      settings.autoBingeNextChapter &&
      !loading &&
      pages.length > 0 &&
      chapterIndex + 1 < chapters.length
    ) {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
      if (atBottom && !bingeTimerRef.current) {
        bingeTimerRef.current = window.setTimeout(() => {
          bingeTimerRef.current = null;
          setChapterIndex((i) => Math.min(chapters.length - 1, i + 1));
          setCurrentPage(0);
          scrollContainerRef.current?.scrollTo({ top: 0 });
        }, 850);
      } else if (!atBottom && bingeTimerRef.current) {
        window.clearTimeout(bingeTimerRef.current);
        bingeTimerRef.current = null;
      }
    }
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((z) => {
      const next = Math.min(3, Math.max(1, +(z + delta).toFixed(2)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClickZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(1.75);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current) return;
    setPan({
      x: panStartRef.current.px + (e.clientX - panStartRef.current.x),
      y: panStartRef.current.py + (e.clientY - panStartRef.current.y),
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  // Touch pinch-to-zoom, 1-finger pan, AND horizontal page swipe for phones/tablets
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const touchSwipeRef = useRef<{ x: number; y: number; dx: number; dy: number; active: boolean } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      touchSwipeRef.current = null;
      setSwipeOffset(0);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartZoomRef.current = zoom;
    } else if (e.touches.length === 1 && zoom > 1) {
      touchSwipeRef.current = null;
      panStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        px: pan.x,
        py: pan.y,
      };
    } else if (e.touches.length === 1 && zoom <= 1.02 && mode !== 'webtoon') {
      touchSwipeRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        dx: 0,
        dy: 0,
        active: true,
      };
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / pinchStartDistRef.current;
      const next = Math.min(3, Math.max(1, +(pinchStartZoomRef.current * scale).toFixed(2)));
      setZoom(next);
      if (next === 1) setPan({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && zoom > 1 && panStartRef.current) {
      setPan({
        x: panStartRef.current.px + (e.touches[0].clientX - panStartRef.current.x),
        y: panStartRef.current.py + (e.touches[0].clientY - panStartRef.current.y),
      });
    } else if (e.touches.length === 1 && touchSwipeRef.current?.active && mode !== 'webtoon') {
      const dx = e.touches[0].clientX - touchSwipeRef.current.x;
      const dy = e.touches[0].clientY - touchSwipeRef.current.y;
      touchSwipeRef.current.dx = dx;
      touchSwipeRef.current.dy = dy;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        setSwipeOffset(Math.max(-96, Math.min(96, dx * 0.45)));
      }
    }
  };
  const handleTouchEnd = () => {
    const sw = touchSwipeRef.current;
    if (sw?.active && mode !== 'webtoon') {
      const absX = Math.abs(sw.dx);
      const absY = Math.abs(sw.dy);
      if (absX > 38 && absX > absY * 1.1) {
        lastSwipeAtRef.current = Date.now();
        if (mode === 'rtl') {
          if (sw.dx > 0) goNextPage();
          else goPrevPage();
        } else {
          if (sw.dx < 0) goNextPage();
          else goPrevPage();
        }
      }
    }
    setSwipeOffset(0);
    touchSwipeRef.current = null;
    pinchStartDistRef.current = null;
    panStartRef.current = null;
  };

  const fitClass = useMemo(() => {
    if (fit === 'height') return 'max-h-[94vh] w-auto object-contain';
    if (fit === 'original') return 'w-auto max-w-none';
    return mode === 'webtoon' ? 'w-full max-w-[900px] h-auto' : 'max-w-[92vw] max-h-[92vh] object-contain';
  }, [fit, mode]);

  if (!readerSession || !manga || !chapter) return null;

  const effectiveContrast = settings.oledInk
    ? Math.max(settings.contrast, 118)
    : settings.contrast;
  const effectiveBrightness = settings.oledInk
    ? Math.min(settings.brightness, 96)
    : settings.brightness;

  const filterStyle: React.CSSProperties = {
    filter: `brightness(${effectiveBrightness}%) contrast(${effectiveContrast}%) sepia(${settings.warmth}%)`,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onWheel={handleWheelZoom}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`fixed inset-0 z-50 flex flex-col bg-black text-white select-none ${
        zoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
      }`}
    >
      {/* Subtle permanent top-left Back button when HUD is hidden */}
      {!hudVisible && (
        <button
          onClick={closeReader}
          title="Exit Reader (Esc) · Press H or click page for HUD"
          className="oled-glass-subtle fixed left-4 top-4 z-30 flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs text-zinc-300 opacity-35 transition hover:opacity-100 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </button>
      )}

      {/* Top Floating Glass HUD */}
      <AnimatePresence>
        {hudVisible && (
          <motion.header
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.18 }}
            className="oled-glass absolute left-1/2 top-4 z-30 flex w-[92%] max-w-4xl -translate-x-1/2 items-center justify-between rounded-2xl px-4 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={closeReader}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/15 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{manga.title}</div>
                <div className="truncate font-mono-tech text-[11px] text-zinc-400">
                  {chapter.number > 0 ? `Ch. ${chapter.number}` : 'Chapter'}
                  {chapter.title ? ` — ${chapter.title}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 font-mono-tech text-xs text-zinc-200">
                {pages.length > 0 ? `${currentPage + 1} / ${pages.length}` : '—'}
              </span>

              <button
                onClick={() => setChapterDrawerOpen((o) => !o)}
                title="Chapter List (C)"
                className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] transition cursor-pointer ${
                  chapterDrawerOpen
                    ? 'border-white/30 bg-white text-black font-semibold'
                    : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.reader.chapters}</span>
              </button>

              {mode === 'webtoon' && (
                <button
                  onClick={() => setAutoScroll((s) => !s)}
                  title="Auto-Scroll Cruise (A / Space)"
                  className={`flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[11px] transition cursor-pointer ${
                    autoScroll
                      ? 'accent-bg border-white/40 font-semibold'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white'
                  }`}
                >
                  {autoScroll ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  <span>{t.reader.cruise}</span>
                </button>
              )}

              <button
                onClick={() => setHudVisible(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white cursor-pointer"
                title="Hide HUD (H)"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => window.noctis.toggleFullscreen().then(setIsFullscreen)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white cursor-pointer"
                title="Fullscreen (F)"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Reading Viewport */}
      <div
        ref={scrollContainerRef}
        onScroll={mode === 'webtoon' ? handleWebtoonScroll : undefined}
        className={`relative flex-1 ${
          mode === 'webtoon'
            ? 'overflow-y-auto overflow-x-hidden'
            : 'flex items-center justify-center overflow-hidden'
        }`}
        style={filterStyle}
      >
        {loading && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-7 w-7 animate-spin text-white" />
            <span className="font-mono-tech text-xs tracking-wider uppercase">
              Loading Pages...
            </span>
          </div>
        )}

        {error && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-rose-300">{error}</p>
            <button
              onClick={closeReader}
              className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-black cursor-pointer"
            >
              Return
            </button>
          </div>
        )}

        {!loading && !error && pages.length > 0 && mode === 'webtoon' && (
          <div
            onClick={() => {
              if (zoom === 1) setHudVisible((v) => !v);
            }}
            onDoubleClick={handleDoubleClickZoom}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center top',
            }}
            className="mx-auto flex w-full flex-col items-center pb-24 pt-4 transition-transform duration-150 ease-out"
          >
            {pages.map((src, idx) => (
              <div
                key={`${chapter.id}-${idx}`}
                data-page-idx={idx}
                ref={(el) => {
                  pageRefs.current[idx] = el;
                }}
                className="flex w-full justify-center"
              >
                <ResilientReaderImage
                  src={src}
                  alt={`Page ${idx + 1}`}
                  loading={idx < 4 ? 'eager' : 'lazy'}
                  className={fitClass}
                />
              </div>
            ))}

            {chapterIndex + 1 < chapters.length && (
              <div className="mt-10 flex flex-col items-center gap-3 py-8">
                <span className="font-mono-tech text-xs text-zinc-500">End of Chapter</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChapterIndex((i) => i + 1);
                    setCurrentPage(0);
                    scrollContainerRef.current?.scrollTo({ top: 0 });
                  }}
                  className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black shadow-[0_0_24px_rgba(255,255,255,0.25)] transition hover:scale-105 cursor-pointer"
                >
                  Next: Ch. {chapters[chapterIndex + 1].number || chapterIndex + 2}
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && !error && pages.length > 0 && mode !== 'webtoon' && (
          <div
            onDoubleClick={handleDoubleClickZoom}
            style={{
              transform: `translate(${pan.x + swipeOffset}px, ${pan.y}px) scale(${zoom})`,
              touchAction: 'pan-y',
            }}
            className="relative flex h-full w-full items-center justify-center transition-transform duration-150 ease-out"
          >
            {zoom === 1 && (
              <>
                <div
                  onClick={() => {
                    if (Date.now() - lastSwipeAtRef.current < 260) return;
                    mode === 'rtl' ? goNextPage() : goPrevPage();
                  }}
                  className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize"
                />
                <div
                  onClick={() => {
                    if (Date.now() - lastSwipeAtRef.current < 260) return;
                    setHudVisible((v) => !v);
                  }}
                  className="absolute inset-y-0 left-1/3 z-10 w-1/3 cursor-pointer"
                />
                <div
                  onClick={() => {
                    if (Date.now() - lastSwipeAtRef.current < 260) return;
                    mode === 'rtl' ? goPrevPage() : goNextPage();
                  }}
                  className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-e-resize"
                />
              </>
            )}

            {mode === 'double' ? (
              <div className="flex items-center justify-center gap-2">
                <ResilientReaderImage
                  src={pages[currentPage]}
                  alt={`Page ${currentPage + 1}`}
                  className="max-h-[92vh] max-w-[46vw] object-contain"
                />
                {currentPage + 1 < pages.length && (
                  <ResilientReaderImage
                    src={pages[currentPage + 1]}
                    alt={`Page ${currentPage + 2}`}
                    className="max-h-[92vh] max-w-[46vw] object-contain"
                  />
                )}
              </div>
            ) : (
              <ResilientReaderImage
                src={pages[currentPage]}
                alt={`Page ${currentPage + 1}`}
                className={fitClass}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom Floating Glass Capsule */}
      <AnimatePresence>
        {hudVisible && (
          <motion.footer
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            className="oled-glass absolute bottom-5 left-1/2 z-30 flex w-[92%] max-w-4xl -translate-x-1/2 flex-col gap-2.5 rounded-2xl px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <button
                disabled={chapterIndex <= 0}
                onClick={() => {
                  setChapterIndex((i) => i - 1);
                  setCurrentPage(0);
                }}
                className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-[11px] text-zinc-200 disabled:opacity-30 hover:bg-white/10 cursor-pointer"
                title="Previous Chapter ([)"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev Ch</span>
              </button>

              <div
                className="relative flex flex-1 items-center"
                onMouseMove={(e) => {
                  if (pages.length <= 1) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const page = Math.round(pct * (pages.length - 1));
                  setHoverPagePreview({ page, pct: pct * 100 });
                }}
                onMouseLeave={() => setHoverPagePreview(null)}
              >
                {hoverPagePreview && pages.length > 0 && (
                  <div
                    style={{ left: `${hoverPagePreview.pct}%` }}
                    className="pointer-events-none absolute -top-9 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/15 bg-black/95 px-2.5 py-1 font-mono-tech text-[10px] text-white shadow-xl"
                  >
                    Page {hoverPagePreview.page + 1} / {pages.length}
                  </div>
                )}
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, pages.length - 1)}
                  value={currentPage}
                  onChange={(e) => {
                    const target = Number(e.target.value);
                    setCurrentPage(target);
                    if (mode === 'webtoon') {
                      pageRefs.current[target]?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="h-1 w-full cursor-pointer accent-white"
                />
              </div>

              <button
                disabled={chapterIndex + 1 >= chapters.length}
                onClick={() => {
                  setChapterIndex((i) => i + 1);
                  setCurrentPage(0);
                }}
                className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-[11px] text-zinc-200 disabled:opacity-30 hover:bg-white/10 cursor-pointer"
                title="Next Chapter (])"
              >
                <span>Next Ch</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
                {(
                  [
                    { id: 'webtoon', label: 'Webtoon', icon: MoveVertical },
                    { id: 'rtl', label: 'RTL Manga', icon: MoveHorizontal },
                    { id: 'ltr', label: 'LTR', icon: MoveHorizontal },
                    { id: 'double', label: 'Spread', icon: Columns2 },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMode(item.id);
                        const mKey = `${manga.source}::${manga.id}`;
                        void updateSettings({
                          mangaReaderPrefs: {
                            ...(settings.mangaReaderPrefs ?? {}),
                            [mKey]: { ...(settings.mangaReaderPrefs?.[mKey] ?? {}), mode: item.id },
                          },
                        });
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] transition cursor-pointer ${
                        active ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Zoom controls */}
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
                  <button
                    onClick={() =>
                      setZoom((z) => {
                        const n = Math.max(1, +(z - 0.25).toFixed(2));
                        if (n === 1) setPan({ x: 0, y: 0 });
                        return n;
                      })
                    }
                    className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-10 text-center font-mono-tech text-[10px] text-zinc-200">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                    className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                    title="Zoom In (+)"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  {zoom > 1 && (
                    <button
                      onClick={() => {
                        setZoom(1);
                        setPan({ x: 0, y: 0 });
                      }}
                      className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                      title="Reset Zoom (0)"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
                  {(['width', 'height', 'original'] as FitMode[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setFit(f);
                        const mKey = `${manga.source}::${manga.id}`;
                        void updateSettings({
                          mangaReaderPrefs: {
                            ...(settings.mangaReaderPrefs ?? {}),
                            [mKey]: { ...(settings.mangaReaderPrefs?.[mKey] ?? {}), fit: f },
                          },
                        });
                      }}
                      className={`rounded-lg px-2.5 py-1 text-[11px] capitalize transition cursor-pointer ${
                        fit === f ? 'bg-white/20 text-white font-medium' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => void updateSettings({ oledInk: !settings.oledInk })}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] transition cursor-pointer ${
                    settings.oledInk
                      ? 'accent-bg border-white/40 font-semibold'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white'
                  }`}
                  title="OLED Black Ink Contrast Boost"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{t.reader.oledInk}</span>
                </button>

                {mode === 'webtoon' && (
                  <button
                    onClick={() =>
                      void updateSettings({ autoBingeNextChapter: !settings.autoBingeNextChapter })
                    }
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] transition cursor-pointer ${
                      settings.autoBingeNextChapter
                        ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200 font-semibold'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white'
                    }`}
                    title="Auto-advance to next chapter when scrolling to bottom"
                  >
                    <span>{t.reader.bingeNext}</span>
                  </button>
                )}

                <button
                  onClick={() => setShowDisplayPanel((s) => !s)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] transition cursor-pointer ${
                    showDisplayPanel
                      ? 'accent-bg border-white/30 font-medium'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white'
                  }`}
                >
                  <Sliders className="h-3 w-3" />
                  <span>{t.reader.display}</span>
                </button>
              </div>
            </div>

            {showDisplayPanel && (
              <div className="grid grid-cols-1 gap-3 border-t border-white/[0.08] pt-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 text-xs text-zinc-300">
                  <Sun className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="w-20">{t.reader.brightness}</span>
                  <input
                    type="range"
                    min={40}
                    max={120}
                    value={settings.brightness}
                    onChange={(e) => void updateSettings({ brightness: Number(e.target.value) })}
                    className="flex-1 accent-white"
                  />
                  <span className="w-10 text-right font-mono-tech text-[11px]">
                    {settings.brightness}%
                  </span>
                </label>

                <label className="flex items-center gap-3 text-xs text-zinc-300">
                  <Contrast className="h-3.5 w-3.5 text-zinc-300" />
                  <span className="w-20">{t.reader.contrast}</span>
                  <input
                    type="range"
                    min={80}
                    max={145}
                    value={settings.contrast}
                    onChange={(e) => void updateSettings({ contrast: Number(e.target.value) })}
                    className="flex-1 accent-white"
                  />
                  <span className="w-10 text-right font-mono-tech text-[11px]">
                    {settings.contrast}%
                  </span>
                </label>

                <label className="flex items-center gap-3 text-xs text-zinc-300">
                  <Eye className="h-3.5 w-3.5 text-zinc-300" />
                  <span className="w-20">{t.reader.warmth}</span>
                  <input
                    type="range"
                    min={0}
                    max={45}
                    value={settings.warmth}
                    onChange={(e) => void updateSettings({ warmth: Number(e.target.value) })}
                    className="flex-1 accent-white"
                  />
                  <span className="w-10 text-right font-mono-tech text-[11px]">
                    {settings.warmth}%
                  </span>
                </label>

                {mode === 'webtoon' && (
                  <label className="flex items-center gap-3 text-xs text-zinc-300">
                    <Play className="h-3.5 w-3.5 accent-fg" />
                    <span className="w-20">{t.reader.cruiseSpeed}</span>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      step={0.5}
                      value={settings.autoScrollSpeed}
                      onChange={(e) =>
                        void updateSettings({ autoScrollSpeed: Number(e.target.value) })
                      }
                      className="flex-1 accent-white"
                    />
                    <span className="w-10 text-right font-mono-tech text-[11px]">
                      {settings.autoScrollSpeed}x
                    </span>
                  </label>
                )}
              </div>
            )}
          </motion.footer>
        )}
      </AnimatePresence>

      {/* Slide-over In-Reader Chapter List Drawer */}
      <AnimatePresence>
        {chapterDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChapterDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/60"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 right-0 z-50 flex w-80 max-w-[88vw] flex-col border-l border-white/10 bg-[#0A0A0D] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
                <div>
                  <h3 className="text-sm font-semibold text-white">{t.reader.chapters}</h3>
                  <p className="font-mono-tech text-[11px] text-zinc-500">
                    {chapters.length}
                  </p>
                </div>
                <button
                  onClick={() => setChapterDrawerOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="border-b border-white/[0.06] px-3 py-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    placeholder={t.reader.jumpChapter}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {chapters
                  .map((ch, idx) => ({ ch, idx }))
                  .filter(({ ch }) => {
                    const q = chapterSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (ch.title ?? '').toLowerCase().includes(q) ||
                      String(ch.number).includes(q)
                    );
                  })
                  .map(({ ch, idx }) => {
                    const isCurrent = idx === chapterIndex;
                    const isRead = readChapterIds.has(ch.id);
                    return (
                      <button
                        key={ch.id}
                        onClick={() => {
                          setChapterIndex(idx);
                          setCurrentPage(0);
                          setChapterDrawerOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition cursor-pointer ${
                          isCurrent
                            ? 'accent-pill border'
                            : 'border-transparent bg-white/[0.02] text-zinc-300 hover:border-white/10 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div
                            className={`truncate text-xs font-medium ${
                              isCurrent
                                ? 'accent-fg'
                                : isRead
                                  ? 'text-zinc-500'
                                  : 'text-zinc-200'
                            }`}
                          >
                            {ch.number > 0 ? `Ch. ${ch.number}` : 'Chapter'}
                            {ch.title ? ` — ${ch.title}` : ''}
                          </div>
                          {ch.scanlator && (
                            <div className="truncate font-mono-tech text-[10px] text-zinc-600">
                              {ch.scanlator}
                            </div>
                          )}
                        </div>
                        {isCurrent ? (
                          <span className="accent-bg shrink-0 rounded-full px-2 py-0.5 font-mono-tech text-[9px] font-bold">
                            {t.reader.now}
                          </span>
                        ) : isRead ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
