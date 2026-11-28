import { memo, useEffect, useRef, useState } from 'react';
import { Bookmark, BookOpen, ExternalLink, Play, Search } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Manga } from '../types';
import { getProxiedImageUrl } from '../utils/api';

interface MangaCardProps {
  manga: Manga;
  subtitle?: string;
  progressPercent?: number;
  badge?: string;
  broken?: boolean;
  showSource?: boolean;
  onClick?: () => void;
  onQuickPlay?: () => void;
  compact?: boolean;
}

export const MangaCard = memo(function MangaCard({
  manga,
  subtitle,
  progressPercent,
  badge,
  broken = false,
  showSource = true,
  onClick,
  onQuickPlay,
  compact = false,
}: MangaCardProps) {
  const {
    engineStatus,
    library,
    openManga,
    toggleLibraryManga,
    openCommandWithQuery,
    prefetchMangaDetails,
  } = useAppStore();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  const key = `${manga.source}::${manga.id}`;
  const libEntry = library.find((e) => e.key === key);
  const inLibrary = Boolean(libEntry);
  const unread = libEntry?.unreadCount ?? 0;

  const primaryUrl = manga.coverUrl || manga.largeCoverUrl || '';
  const secondaryUrl =
    manga.largeCoverUrl && manga.largeCoverUrl !== primaryUrl ? manga.largeCoverUrl : '';
  const proxiedPrimary = getProxiedImageUrl(engineStatus.url, manga.source, primaryUrl);
  const proxiedSecondary = secondaryUrl
    ? getProxiedImageUrl(engineStatus.url, manga.source, secondaryUrl)
    : '';

  const candidateSrcs = [
    proxiedPrimary,
    proxiedPrimary && proxiedPrimary.includes('/api/image?') ? `${proxiedPrimary}&r=1` : '',
    proxiedSecondary,
    primaryUrl.startsWith('http') ? primaryUrl : '',
  ].filter(Boolean);

  const coverSrc = candidateSrcs[retryCount] ?? '';

  useEffect(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setImgLoaded(false);
    setImgError(false);
    setRetryCount(0);
    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [proxiedPrimary, primaryUrl]);

  useEffect(() => {
    if (!imgError) return;
    const onOnline = () => {
      setImgError(false);
      setRetryCount(0);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [imgError]);

  const handleImgError = () => {
    if (retryCount + 1 < candidateSrcs.length) {
      const delayMs = 350 * (retryCount + 1);
      retryTimerRef.current = window.setTimeout(() => {
        setRetryCount((c) => c + 1);
      }, delayMs);
    } else {
      setImgError(true);
    }
  };

  const handleMouseEnter = () => {
    if (manga.source === 'LOCAL') return;
    hoverTimerRef.current = window.setTimeout(() => {
      void prefetchMangaDetails(manga);
    }, 160);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!menuPos) return;
    const closeMenu = () => setMenuPos(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('contextmenu', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('contextmenu', closeMenu);
    };
  }, [menuPos]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 210);
    const y = Math.min(e.clientY, window.innerHeight - 170);
    setMenuPos({ x, y });
  };

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onClick={onClick ?? (() => openManga(manga))}
        className={`cv-card group relative flex flex-col cursor-pointer select-none transition-transform duration-200 ease-out hover:-translate-y-1 ${
          compact ? 'w-[124px] sm:w-[156px] shrink-0' : 'w-full'
        }`}
      >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0d] transition-colors duration-200 group-hover:border-white/25">
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />
        )}

        {coverSrc && !imgError ? (
          <img
            src={coverSrc}
            alt=""
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={handleImgError}
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : !coverSrc && (manga.coverUrl || manga.largeCoverUrl) ? (
          <div className="flex h-full w-full animate-pulse items-center justify-center bg-white/[0.04]" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-zinc-600">
            <BookOpen className="h-7 w-7 opacity-40" />
            <span className="line-clamp-3 text-xs font-medium text-zinc-500">{manga.title}</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-1">
          {(broken || showSource) && (
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
                broken
                  ? 'border-rose-500/40 bg-rose-950/90 text-rose-200'
                  : 'border-white/10 bg-black/80 text-zinc-300'
              }`}
            >
              {broken ? 'Broken' : manga.source === 'LOCAL' ? 'CBZ' : manga.source.slice(0, 10)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {unread > 0 && (
              <span className="accent-bg rounded-md px-1.5 py-0.5 font-mono-tech text-[9px] font-bold">
                +{unread}
              </span>
            )}
            {inLibrary && (
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-black">
                <Bookmark className="h-3 w-3 fill-black" />
              </span>
            )}
          </div>
        </div>

        {badge && (
          <div className="pointer-events-none absolute right-2 bottom-2.5 rounded-md border border-white/10 bg-black/80 px-1.5 py-0.5 font-mono-tech text-[10px] text-white/90">
            {badge}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {onQuickPlay && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickPlay();
            }}
            title="Resume / Quick Play"
            className="absolute bottom-2.5 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-lg transition-all duration-150 group-hover:opacity-100 hover:scale-110 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-black ml-0.5" />
          </button>
        )}

        {typeof progressPercent === 'number' && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
            <div
              className="h-full bg-white"
              style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-[13px] font-medium tracking-[-0.01em] text-zinc-100 transition-colors group-hover:text-white">
          {manga.title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 line-clamp-1 font-mono-tech text-[11px] text-zinc-500">{subtitle}</p>
        ) : (
          manga.authors?.[0] && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{manga.authors[0]}</p>
          )
        )}
      </div>
    </div>

      {menuPos && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ left: menuPos.x, top: menuPos.y }}
          className="fixed z-[95] w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#0C0C10] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.9)]"
        >
          {onQuickPlay && (
            <button
              onClick={() => {
                setMenuPos(null);
                onQuickPlay();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-white transition hover:bg-white/10 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              <span>Resume Reading</span>
            </button>
          )}
          <button
            onClick={() => {
              setMenuPos(null);
              openManga(manga);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-zinc-200 transition hover:bg-white/10 cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Details</span>
          </button>
          <button
            onClick={() => {
              setMenuPos(null);
              void toggleLibraryManga(manga);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-zinc-200 transition hover:bg-white/10 cursor-pointer"
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>{inLibrary ? 'Remove from Library' : 'Add to Library'}</span>
          </button>
          <button
            onClick={() => {
              setMenuPos(null);
              openCommandWithQuery(manga.title);
            }}
            className="accent-fg flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition hover:bg-white/10 cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Find Other Sources</span>
          </button>
        </div>
      )}
    </>
  );
});
