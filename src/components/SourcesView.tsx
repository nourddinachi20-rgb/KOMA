import { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Loader2, Pin, RefreshCw, Search, Shield } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { SourceInfo } from '../types';
import { fetchSources } from '../utils/api';

const LANG_TABS = [
  { id: 'all', label: 'All Verified' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'ar', label: 'العربية' },
  { id: 'multi', label: 'Multi-Lang' },
] as const;

export function SourcesView() {
  const {
    sources,
    engineStatus,
    settings,
    updateSettings,
    setExploreSource,
    verifyWorkingSources,
    verifyingSources,
  } = useAppStore();
  const [query, setQuery] = useState('');
  const [langFilter, setLangFilter] = useState<string>('all');
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [showAllCf, setShowAllCf] = useState(false);
  const [allSources, setAllSources] = useState<SourceInfo[] | null>(null);

  const activePool = showAllCf && allSources ? allSources : sources;

  const toggleShowAllCf = async () => {
    const next = !showAllCf;
    setShowAllCf(next);
    if (next && !allSources && engineStatus.ready && engineStatus.url) {
      const list = await fetchSources(engineStatus.url, true);
      setAllSources(list.filter((s) => ['en', 'fr', 'ar', ''].includes(s.locale)));
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
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-6 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Working Sources</h1>
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 font-mono-tech text-[10px] text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              {counts.all} VERIFIED LIVE
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sources..."
              className="w-52 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-9 pr-4 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none"
            />
          </div>

          <button
            onClick={() => void toggleShowAllCf()}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
              showAllCf
                ? 'border-[#EAC278]/50 bg-[#EAC278] text-black'
                : 'border-white/15 bg-white/[0.06] text-zinc-300 hover:border-white/30 hover:text-white'
            }`}
            title="Show CF-gated & unverified EN/FR/AR extensions to unlock them"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>{showAllCf ? 'Showing All' : 'CF Unlock Mode'}</span>
          </button>

          <button
            onClick={verifyWorkingSources}
            disabled={verifyingSources}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-white transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50 cursor-pointer"
          >
            {verifyingSources ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>{verifyingSources ? 'Scanning Live...' : 'Re-Verify Live'}</span>
          </button>
        </div>
      </div>

      {/* Language Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.05] px-6 py-3">
        {LANG_TABS.map((tab) => {
          const active = langFilter === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setLangFilter(tab.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
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

      <div className="flex-1 overflow-y-auto p-6">
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
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/25 hover:text-[#EAC278] cursor-pointer"
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
                    title={pinned ? 'Unpin from Home & Quick Search' : 'Pin to Home & Quick Search'}
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
      </div>
    </div>
  );
}
