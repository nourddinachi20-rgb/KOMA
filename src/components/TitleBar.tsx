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
        className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-medium transition cursor-pointer ${
          active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
        }`}
      >
        <div
          className={`relative flex h-7 w-11 items-center justify-center rounded-full transition ${
            active ? 'accent-bg' : ''
          }`}
        >
          <Icon className="h-4 w-4" />
          {badge > 0 && (
            <span className="accent-bg absolute -right-1 -top-1 rounded-full px-1 font-mono-tech text-[8px] font-bold">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <div className="pb-safe relative z-40 shrink-0 border-t border-white/[0.08] bg-black/95 px-2 pt-2 pb-1.5 select-none md:flex md:justify-center">
      <nav className="grid w-full grid-cols-5 items-end gap-1 md:max-w-lg">
        {navBtn('home', t.nav.home, Home)}
        {navBtn('library', t.nav.library, Library, updates.length)}

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label={t.nav.search}
          className="group flex flex-col items-center justify-center gap-0.5 pt-1 pb-0.5 cursor-pointer"
        >
          <div className="accent-bg flex h-9 w-12 items-center justify-center rounded-2xl border border-white/15 shadow-[0_6px_22px_rgba(var(--koma-accent-rgb),0.28)] transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
            <Search className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </div>
          <span className="text-[10px] font-semibold text-white">{t.nav.search}</span>
        </button>

        {navBtn('explore', t.nav.explore, Compass)}
        {navBtn('settings', t.nav.settings, Settings)}
      </nav>
    </div>
  );
}
