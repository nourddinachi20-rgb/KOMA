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
import { KomaLogo } from './KomaLogo';

const isDesktopShell =
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');

const NAV_ITEMS: Array<{ id: NavView; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'updates', label: 'Updates', icon: Bell },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'downloads', label: 'Offline', icon: Download },
  { id: 'sources', label: 'Sources', icon: Layers },
];

export function TitleBar() {
  const { activeView, setActiveView, closeManga, setCommandOpen, engineStatus, sources, updates } =
    useAppStore();

  const navigateTo = (view: NavView) => {
    closeManga();
    setActiveView(view);
  };

  return (
    <header className="app-drag pt-safe relative z-40 flex min-h-14 w-full shrink-0 items-center justify-between px-4 sm:px-5 select-none">
      {/* Brand + live engine pill */}
      <div className="app-no-drag flex items-center gap-3">
        <button
          onClick={() => navigateTo('home')}
          className="group flex items-center gap-2.5 text-left focus:outline-none cursor-pointer"
        >
          <KomaLogo className="h-7 w-7 transition-transform duration-300 group-hover:scale-105" />
          <span className="text-[13px] font-bold tracking-[0.26em] text-white/95">KOMA</span>
        </button>

        <div
          className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] font-mono-tech text-zinc-400"
          title={engineStatus.error || 'Bundled Verified Source Engine'}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              engineStatus.ready
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : engineStatus.error
                  ? 'bg-rose-400'
                  : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span>
            {engineStatus.ready
              ? `${sources.length || engineStatus.sourcesCount} SOURCES`
              : engineStatus.error
                ? 'ENGINE OFFLINE'
                : 'BOOTING'}
          </span>
        </div>
      </div>

      {/* Centered Floating Glass Pill Navigation (Tablets & Desktop) */}
      <nav className="app-no-drag oled-glass-subtle hidden md:flex items-center gap-1 rounded-full p-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          const badge = item.id === 'updates' && updates.length > 0 ? updates.length : 0;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 cursor-pointer ${
                active ? 'text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="noctis-nav-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-white shadow-[0_2px_16px_rgba(255,255,255,0.28)]"
                />
              )}
              <Icon className="relative z-10 h-3.5 w-3.5" strokeWidth={2} />
              <span className="relative z-10">{item.label}</span>
              {badge > 0 && (
                <span
                  className={`relative z-10 rounded-full px-1.5 py-0.2 font-mono-tech text-[9px] font-bold ${
                    active ? 'bg-black text-white' : 'bg-[#EAC278] text-black'
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
      <div className="app-no-drag flex items-center gap-2">
        <button
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white cursor-pointer"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden lg:inline rounded bg-white/[0.07] px-1.5 py-0.5 font-mono-tech text-[10px] text-zinc-400">
            Ctrl K
          </kbd>
        </button>

        <button
          onClick={() => navigateTo('settings')}
          title="Settings"
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition cursor-pointer ${
            activeView === 'settings'
              ? 'border-white/30 bg-white text-black'
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
  const [moreOpen, setMoreOpen] = useState(false);

  const go = (view: NavView) => {
    closeManga();
    setActiveView(view);
    setMoreOpen(false);
  };

  const primaryTabs: Array<{ id: NavView; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'updates', label: 'Updates', icon: Bell },
    { id: 'explore', label: 'Explore', icon: Compass },
  ];

  const inMore = activeView === 'downloads' || activeView === 'sources' || activeView === 'settings';

  return (
    <div className="md:hidden pb-safe relative z-40 shrink-0 border-t border-white/[0.08] bg-black/95 px-2 pt-1.5 pb-1.5 select-none">
      {moreOpen && (
        <div className="absolute bottom-full right-3 mb-2 w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#0C0C10] p-1.5 shadow-2xl">
          {[
            { id: 'downloads' as NavView, label: 'Offline CBZ', icon: Download },
            { id: 'sources' as NavView, label: 'Sources', icon: Layers },
            { id: 'settings' as NavView, label: 'Settings', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium cursor-pointer ${
                  active ? 'bg-white text-black' : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
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
                  active ? 'bg-white text-black' : ''
                }`}
              >
                <Icon className="h-4 w-4" />
                {badge > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-[#EAC278] px-1 font-mono-tech text-[8px] font-bold text-black">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition cursor-pointer ${
            inMore || moreOpen ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <div
            className={`flex h-7 w-11 items-center justify-center rounded-full transition ${
              inMore ? 'bg-white text-black' : ''
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </div>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
