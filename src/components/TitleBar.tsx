import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Compass,
  Download,
  Home,
  Layers,
  Library,
  Minus,
  MoreHorizontal,
  Search,
  Settings,
  Square,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { NavView } from '../types';
import { useT } from '../utils/i18n';
import { closeAllPopovers, useClosePopoversListener } from './CustomSelect';
import { KomaLogo } from './KomaLogo';

const isDesktopShell =
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');

export function TitleBar() {
  const { activeView, setActiveView, closeManga, setCommandOpen, engineStatus, sources, settings, updates } =
    useAppStore();
  const t = useT();

  const visibleSourcesCount = settings.showNsfw
    ? sources.length
    : sources.filter((s) => s.contentType !== 'HENTAI').length;

  const navItems: Array<{ id: NavView; label: string; icon: typeof Home }> = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'library', label: t.nav.library, icon: Library },
    { id: 'updates', label: t.nav.updates, icon: Bell },
    { id: 'explore', label: t.nav.explore, icon: Compass },
    { id: 'downloads', label: t.nav.offline, icon: Download },
    { id: 'sources', label: t.nav.sources, icon: Layers },
  ];

  const navigateTo = (view: NavView) => {
    closeManga();
    setActiveView(view);
  };

  return (
    <header className="app-drag pt-safe relative z-40 flex min-h-14 w-full shrink-0 items-center justify-between gap-2 px-3 sm:px-5 select-none">
      {/* Brand + live engine pill */}
      <div className="app-no-drag flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          onClick={() => navigateTo('home')}
          className="group flex shrink-0 items-center gap-2 text-left focus:outline-none cursor-pointer"
        >
          <KomaLogo className="h-7 w-7 shrink-0 transition-transform duration-300 group-hover:scale-105" />
          <span className="text-[13px] font-bold tracking-[0.2em] lg:tracking-[0.26em] text-white/95">KOMA</span>
        </button>

        <div
          className="hidden lg:flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] font-mono-tech text-zinc-400"
          title={engineStatus.error || 'Bundled Verified Source Engine'}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              engineStatus.ready
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : engineStatus.error
                  ? 'bg-rose-400'
                  : 'bg-white animate-pulse'
            }`}
          />
          <span>
            {engineStatus.ready
              ? `${sources.length > 0 ? visibleSourcesCount : engineStatus.sourcesCount}`
              : engineStatus.error
                ? 'OFF'
                : '...'}
          </span>
        </div>
      </div>

      {/* Centered Floating Glass Pill Navigation (Tablets & Desktop) */}
      <nav className="app-no-drag oled-glass-subtle hidden md:flex items-center gap-0.5 lg:gap-1 rounded-full p-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          const badge = item.id === 'updates' && updates.length > 0 ? updates.length : 0;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`relative flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full px-2.5 lg:px-3.5 py-1.5 text-[11px] lg:text-xs font-medium transition-colors duration-200 cursor-pointer ${
                active ? '' : 'text-zinc-400 hover:text-white'
              }`}
              style={active ? { color: 'var(--koma-accent-fg)' } : undefined}
            >
              {active && (
                <motion.span
                  layoutId="noctis-nav-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  style={{ backgroundColor: 'var(--koma-accent)' }}
                  className="absolute inset-0 rounded-full shadow-[0_2px_16px_rgba(var(--koma-accent-rgb),0.22)]"
                />
              )}
              <Icon className="relative z-10 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className="relative z-10 whitespace-nowrap">{item.label}</span>
              {badge > 0 && (
                <span
                  className={`relative z-10 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 font-mono-tech text-[9px] font-bold leading-none ${
                    active ? 'bg-black/20 text-current' : 'accent-bg'
                  }`}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="app-no-drag flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => setCommandOpen(true)}
          title={t.nav.search}
          className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 lg:px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white cursor-pointer"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden lg:inline whitespace-nowrap">{t.nav.search}</span>
          <kbd className="hidden xl:inline rounded bg-white/[0.07] px-1.5 py-0.5 font-mono-tech text-[10px] text-zinc-400">
            Ctrl K
          </kbd>
        </button>

        <button
          onClick={() => navigateTo('settings')}
          title={t.nav.settings}
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition cursor-pointer ${
            activeView === 'settings'
              ? 'accent-bg border-white/30'
              : 'border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        {isDesktopShell && (
          <div className="ml-2 flex items-center gap-1 border-l border-white/[0.08] pl-2">
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
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const { activeView, setActiveView, closeManga, updates } = useAppStore();
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);

  useClosePopoversListener('mobile-nav-more', () => setMoreOpen(false));

  const go = (view: NavView) => {
    closeManga();
    setActiveView(view);
    setMoreOpen(false);
  };

  const primaryTabs: Array<{ id: NavView; label: string; icon: typeof Home }> = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'library', label: t.nav.library, icon: Library },
    { id: 'updates', label: t.nav.updates, icon: Bell },
    { id: 'explore', label: t.nav.explore, icon: Compass },
  ];

  const inMore = activeView === 'downloads' || activeView === 'sources' || activeView === 'settings';

  return (
    <div className="md:hidden pb-safe relative z-40 shrink-0 border-t border-white/[0.08] bg-black/95 px-2 pt-1.5 pb-1.5 select-none">
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-full right-3 z-40 mb-2 w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#0C0C10] p-1.5 shadow-2xl">
          {[
            { id: 'downloads' as NavView, label: t.nav.offline, icon: Download },
            { id: 'sources' as NavView, label: t.nav.sources, icon: Layers },
            { id: 'settings' as NavView, label: t.nav.settings, icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium cursor-pointer ${
                  active ? 'accent-bg' : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        </>
      )}

      <nav className="grid grid-cols-5 items-center gap-1">
        {primaryTabs.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          const badge = item.id === 'updates' && updates.length > 0 ? updates.length : 0;
          return (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition cursor-pointer ${
                active ? 'text-white' : 'text-zinc-500'
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
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => {
            if (!moreOpen) closeAllPopovers('mobile-nav-more');
            setMoreOpen((o) => !o);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition cursor-pointer ${
            inMore || moreOpen ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <div
            className={`flex h-7 w-11 items-center justify-center rounded-full transition ${
              inMore ? 'accent-bg' : ''
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </div>
          <span>{t.nav.more}</span>
        </button>
      </nav>
    </div>
  );
}
