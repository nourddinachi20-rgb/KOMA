import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Loader2, Pin, RefreshCw, Search, Shield } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { SourceInfo } from '../types';
import { fetchSources } from '../utils/api';
import { useT } from '../utils/i18n';

const LANG_TABS = [
  { id: 'all', label: 'All' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'ar', label: 'العربية' },
  { id: 'multi', label: 'Multi-Lang' },
] as const;

export function SourcesView() {
  const t = useT();
  const {
    sources,
    engineStatus,
    settings,
    updateSettings,
    setActiveView,
    setExploreSource,
    verifyWorkingSources,
    verifyingSources,
  } = useAppStore();
  const [query, setQuery] = useState('');
  const [langFilter, setLangFilter] = useState<string>('all');
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [showAllCf, setShowAllCf] = useState(false);
  const [allSources, setAllSources] = useState<SourceInfo[] | null>(null);
  const [localSources, setLocalSources] = useState<SourceInfo[] | null>(null);

  useEffect(() => {
    if (sources.length > 0) {
      setLocalSources(null);
      return;
    }
    let cancelled = false;
    void window.noctis
      .getEngineStatus()
      .then(async (st) => {
        if (!st.ready || !st.url) return;
        const list = await fetchSources(st.url, false);
        const filtered = list.filter((s) => ['en', 'fr', 'ar', ''].includes(s.locale));
        if (!cancelled) {
          setLocalSources(filtered);
          useAppStore.setState({ engineStatus: st, sources: filtered });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sources.length]);

  const baseSources = sources.length > 0 ? sources : (localSources ?? []);
  const activePool = showAllCf && allSources ? allSources : baseSources;

  const toggleShowAllCf = async () => {
    const next = !showAllCf;
    setShowAllCf(next);
    if (next && !allSources) {
      const st = engineStatus.ready && engineStatus.url ? engineStatus : await window.noctis.getEngineStatus();
      if (st.ready && st.url) {
        const list = await fetchSources(st.url, true);
        setAllSources(list.filter((s) => ['en', 'fr', 'ar', ''].includes(s.locale)));
      }
    }
  };

  const counts = useMemo(() => {
    const clean = activePool.filter((s) => settings.showNsfw || s.contentType !== 'HENTAI');
    return {
      all: clean.length,
      en: clean.filter((s) => s.locale === 'en').length,
      fr: clean.filter((s) => s.locale === 'fr').length,
      ar: clean.filter((s) => s.locale === 'ar').length,
      multi: clean.filter((s) => s.locale === '').length,
    };
  }, [activePool, settings.showNsfw]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activePool
      .filter((s) => {
        if (!settings.showNsfw && s.contentType === 'HENTAI') return false;
        const loc = s.locale || 'multi';
        if (langFilter !== 'all' && loc !== langFilter) return false;
        if (q) {
          return (
            s.title.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            (s.domain ?? '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const aPin = settings.pinnedSources.includes(a.name) ? 0 : 1;
        const bPin = settings.pinnedSources.includes(b.name) ? 0 : 1;
        if (aPin !== bPin) return aPin - bPin;
        return a.title.localeCompare(b.title);
      });
  }, [activePool, query, langFilter, settings.showNsfw, settings.pinnedSources]);

  const togglePin = (name: string) => {
    const exists = settings.pinnedSources.includes(name);
    const next = exists
      ? settings.pinnedSources.filter((x) => x !== name)
      : [name, ...settings.pinnedSources];
    updateSettings({ pinnedSources: next });
  };

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      {/* Header scrolls naturally with the list */}
      <div className="border-b border-white/[0.07] pb-3.5">
        {/* Row 1: Back + Title + Count on left; 18+, All Sources, Refresh on right */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveView('settings')}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t.nav.back}</span>
            </button>
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              {t.sources.title}
            </h1>
            <span className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 font-mono-tech text-[10px] text-zinc-300">
              {counts.all}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void updateSettings({ showNsfw: !settings.showNsfw })}
              className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                settings.showNsfw
                  ? 'accent-bg border-white/40'
                  : 'border-white/15 bg-white/[0.06] text-zinc-300 hover:border-white/30 hover:text-white'
              }`}
            >
              18+
            </button>

            <button
              onClick={() => void toggleShowAllCf()}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                showAllCf
                  ? 'accent-bg border-white/40'
                  : 'border-white/15 bg-white/[0.06] text-zinc-300 hover:border-white/30 hover:text-white'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>{showAllCf ? t.sources.showingAll : t.sources.cfMode}</span>
            </button>

            <button
              onClick={() => void verifyWorkingSources()}
              disabled={verifyingSources}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50 cursor-pointer"
            >
              {verifyingSources ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>{verifyingSources ? t.sources.scanning : t.sources.reverify}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Dedicated Search Bar */}
        <div className="relative mt-3 w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.sources.searchPlaceholder}
            className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2 pl-9 pr-4 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none"
          />
        </div>

        {/* Row 3: Language Tabs */}
        <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
          {LANG_TABS.map((tab) => {
            const active = langFilter === tab.id;
            const count = counts[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setLangFilter(tab.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-white text-black'
                    : 'border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4 pb-6">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((src) => {
              const pinned = settings.pinnedSources.includes(src.name);
              return (
                <div
                  key={src.name}
                  className="cv-chapter flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-white">{src.title}</h3>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono-tech text-[9px] uppercase text-zinc-300">
                        {src.locale || 'MULTI'}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono-tech text-[11px] text-zinc-500">
                      {src.domain || src.contentType}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {src.domain && (
                      <button
                        onClick={async () => {
                          setUnlocking(src.name);
                          try {
                            await window.noctis.solveCloudflare(`https://${src.domain}/`);
                          } finally {
                            setUnlocking(null);
                          }
                        }}
                        title="Solve Cloudflare / Refresh Cookies"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/25 hover:text-white cursor-pointer"
                      >
                        {unlocking === src.name ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Shield className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => togglePin(src.name)}
                      title={pinned ? 'Unpin from Home & Search' : 'Pin to Home & Search'}
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
                        pinned
                          ? 'border-white/30 bg-white text-black'
                          : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => setExploreSource(src.name)}
                      title="Browse Source"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex py-20 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-zinc-400">
              {verifyingSources ? 'Loading sources...' : 'No sources loaded yet.'}
            </p>
            <button
              type="button"
              onClick={() => void verifyWorkingSources()}
              disabled={verifyingSources}
              className="accent-bg rounded-full px-5 py-2 text-xs font-semibold cursor-pointer"
            >
              {verifyingSources ? t.sources.scanning : t.sources.reverify}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
