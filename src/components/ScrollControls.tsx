import { useEffect, useRef, useState } from 'react';
import { ArrowUp, RefreshCw } from 'lucide-react';

export function triggerHaptic(ms = 8): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore on desktop / unsupported WebViews
  }
}

export function triggerScrollToTop(): void {
  window.dispatchEvent(new CustomEvent('koma:scroll-top'));
}

const PULL_THRESHOLD = 58;
const MAX_PULL = 86;

export function PullToRefreshZone({
  scrollRef,
  onRefresh,
  refreshing = false,
  className = '',
  children,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onRefresh: () => Promise<unknown> | void;
  refreshing?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [pullPx, setPullPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const startRef = useRef<{ x: number; y: number; active: boolean; armed: boolean } | null>(null);

  const isBusy = busy || refreshing;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isBusy || e.touches.length !== 1) return;
    const el = scrollRef.current;
    if (!el || el.scrollTop > 2) return;
    startRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      active: false,
      armed: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    const el = scrollRef.current;
    if (!start || !el || isBusy || e.touches.length !== 1) return;

    if (el.scrollTop > 2 && !start.active) {
      startRef.current = null;
      return;
    }

    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;

    if (!start.active) {
      if (dy > 10 && dy > Math.abs(dx) * 1.4 && el.scrollTop <= 1) {
        start.active = true;
        setDragging(true);
      } else if (Math.abs(dx) > 12 || dy < -8) {
        startRef.current = null;
        return;
      }
    }

    if (start.active) {
      const damped = Math.min(MAX_PULL, Math.max(0, (dy - 10) * 0.48));
      setPullPx(damped);
      if (damped >= PULL_THRESHOLD && !start.armed) {
        start.armed = true;
        triggerHaptic(10);
      } else if (damped < PULL_THRESHOLD) {
        start.armed = false;
      }
    }
  };

  const handleTouchEnd = () => {
    const start = startRef.current;
    const currentPull = pullPx;
    startRef.current = null;
    setDragging(false);

    if (!start?.active) {
      setPullPx(0);
      return;
    }

    if (currentPull >= PULL_THRESHOLD && !isBusy) {
      setPullPx(48);
      setBusy(true);
      Promise.resolve(onRefresh())
        .catch(() => {})
        .finally(() => {
          setBusy(false);
          setPullPx(0);
        });
    } else {
      setPullPx(0);
    }
  };

  const heightPx = isBusy ? Math.max(48, pullPx) : pullPx;
  const ready = pullPx >= PULL_THRESHOLD;

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={className}
    >
      <div
        style={{
          height: `${heightPx}px`,
          transition: dragging ? 'none' : 'height 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="flex w-full items-center justify-center overflow-hidden"
        aria-hidden={heightPx === 0}
      >
        {heightPx > 6 && (
          <div
            style={{ opacity: Math.min(1, heightPx / 36) }}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              isBusy || ready
                ? 'border-[rgba(var(--koma-accent-rgb),0.4)] bg-[rgba(var(--koma-accent-rgb),0.14)] text-white'
                : 'border-white/10 bg-white/[0.04] text-zinc-400'
            }`}
          >
            <RefreshCw
              style={
                !isBusy ? { transform: `rotate(${Math.round(pullPx * 3.5)}deg)` } : undefined
              }
              className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin accent-fg' : ready ? 'accent-fg' : ''}`}
            />
            <span>
              {isBusy ? 'Refreshing...' : ready ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function ScrollToTopButton({
  scrollRef,
  bottomClass = 'bottom-4',
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  bottomClass?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      setVisible(el.scrollTop > 320);
    };
    onScroll();

    const onScrollTop = () => {
      if (el.offsetParent !== null && el.scrollTop > 0) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('koma:scroll-top', onScrollTop);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('koma:scroll-top', onScrollTop);
    };
  }, [scrollRef]);

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic(6);
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      aria-label="Scroll to top"
      title="Back to top"
      className={`oled-glass absolute ${bottomClass} right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white shadow-[0_8px_24px_rgba(0,0,0,0.65)] transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <ArrowUp className="h-4 w-4 accent-fg" />
    </button>
  );
}
