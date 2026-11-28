import { useEffect, useState } from 'react';
import { Compass, Home, Library, Search, Settings, Minus, Square, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { NavView } from '../types';
import { useT } from '../utils/i18n';

const isDesktopShell =
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');

export function TitleBar() {
  const { setActiveView, closeManga } = useAppStore();

  return (
    <header className="app-drag pt-safe relative z-40 flex min-h-14 w-full shrink-0 items-center justify-center px-4 select-none">
      <button
        type="button"
        onClick={() => {
          closeManga();
          setActiveView('home');
        }}
        className="app-no-drag cursor-pointer py-1 text-center focus:outline-none"
      >
        <span className="pl-[0.36em] text-xl font-black tracking-[0.36em] text-white sm:text-2xl">
          KOMA
        </span>
      </button>

      {isDesktopShell && (
        <div className="app-no-drag absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <button
            onClick={() => window.noctis.minimize()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => window.noctis.maximize()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Maximize"
          >
            <Square className="h-3 w-3" />
          </button>
          <button
            onClick={() => window.noctis.close()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-rose-500/80 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}

export function MobileBottomNav() {
  const { activeView, setActiveView, closeManga, setCommandOpen, commandOpen, updates } =
    useAppStore();
  const t = useT();

  const activeCol = commandOpen
    ? -1
    : activeView === 'home'
      ? 0
      : activeView === 'library'
        ? 1
        : activeView === 'explore'
          ? 3
          : activeView === 'settings' || activeView === 'sources'
            ? 4
            : -1;

  const [sliderCol, setSliderCol] = useState(activeCol >= 0 ? activeCol : 0);

  useEffect(() => {
    if (activeCol >= 0) {
      setSliderCol(activeCol);
    }
  }, [activeCol]);

  const go = (view: NavView) => {
    closeManga();
    setActiveView(view);
  };

  const navBtn = (view: NavView, label: string, Icon: typeof Home, badge = 0) => {
    const active =
      (activeView === view || (view === 'settings' && activeView === 'sources')) && !commandOpen;
    return (
      <button
        key={view}
        type="button"
        onClick={() => go(view)}
        className={`relative z-10 flex h-12 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors duration-200 cursor-pointer ${
          active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
        }`}
      >
        <div className="relative flex h-7 w-12 items-center justify-center">
          <Icon className="h-5 w-5 transition-transform duration-200" strokeWidth={active ? 2.2 : 1.85} />
          {badge > 0 && (
            <span className="accent-bg absolute right-1 -top-0.5 rounded-full px-1 font-mono-tech text-[8px] font-bold leading-tight">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        <span className="max-w-full truncate leading-tight">{label}</span>
      </button>
    );
  };

  return (
    <div className="pb-safe relative z-40 shrink-0 border-t border-white/[0.08] bg-black/95 px-2 pt-1.5 pb-1 select-none md:flex md:justify-center">
      <nav className="relative grid w-full grid-cols-5 items-center md:max-w-lg">
        {/* Smooth sliding active light & glow pill */}
        <div
          aria-hidden="true"
          style={{ transform: `translate3d(${sliderCol * 100}%, 0, 0)` }}
          className={`pointer-events-none absolute inset-y-0 left-0 z-0 flex w-1/5 flex-col items-center justify-center gap-0.5 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            activeCol >= 0 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="accent-bg absolute -top-1.5 h-[2.5px] w-7 rounded-full shadow-[0_0_12px_2px_rgba(var(--koma-accent-rgb),0.7)]" />
          <div className="h-7 w-12 rounded-2xl border border-[rgba(var(--koma-accent-rgb),0.28)] bg-[rgba(var(--koma-accent-rgb),0.15)] shadow-[0_0_18px_rgba(var(--koma-accent-rgb),0.18)]" />
          <span className="h-[13px] text-[10px] leading-tight opacity-0" aria-hidden="true">
            ·
          </span>
        </div>

        {navBtn('home', t.nav.home, Home)}
        {navBtn('library', t.nav.library, Library, updates.length)}

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label={t.nav.search}
          className="group relative z-10 flex h-12 flex-col items-center justify-center gap-0.5 px-1 cursor-pointer"
        >
          <div className="accent-bg flex h-8 w-12 items-center justify-center rounded-2xl border border-white/15 shadow-[0_4px_18px_rgba(var(--koma-accent-rgb),0.28)] transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
            <Search className="h-5 w-5" strokeWidth={2.3} />
          </div>
          <span className="text-[10px] font-semibold leading-tight text-white">{t.nav.search}</span>
        </button>

        {navBtn('explore', t.nav.explore, Compass)}
        {navBtn('settings', t.nav.settings, Settings)}
      </nav>
    </div>
  );
}
