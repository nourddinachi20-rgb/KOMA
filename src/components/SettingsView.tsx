import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpCircle,
  BookOpen,
  CheckCircle2,
  DownloadCloud,
  ExternalLink,
  HardDrive,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Unlink,
  UploadCloud,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function SettingsView() {
  const {
    settings,
    updateSettings,
    engineStatus,
    refreshEngine,
    refreshAllData,
    trackerConfig,
    refreshTracker,
    setCommandOpen,
    notify,
    appVersion,
    checkingAppUpdate,
    appUpdateInfo,
    appUpdateProgress,
    checkForAppUpdate,
    installAppUpdate,
    setShowWhatsNew,
    replayTutorial,
  } = useAppStore();

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ files: number; bytes: number } | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [anilistList, setAnilistList] = useState<
    Array<{ id: number; title: string; progress: number; totalChapters?: number; cover?: string; status: string }>
  >([]);

  useEffect(() => {
    if (!engineStatus.ready || !engineStatus.url) return;
    fetch(`${engineStatus.url}/api/cache/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.bytes === 'number') setCacheStats(data);
      })
      .catch(() => {});
  }, [engineStatus.ready, engineStatus.url]);

  const handleClearCache = async () => {
    if (!engineStatus.url) return;
    setClearingCache(true);
    try {
      const res = await fetch(`${engineStatus.url}/api/cache/clear`, { method: 'POST' });
      const data = await res.json();
      setCacheStats({ files: 0, bytes: 0 });
      notify(`Cleared ${data.deleted ?? 0} cached images from SSD`, 'success');
    } catch {
      notify('Failed to clear image cache', 'error');
    } finally {
      setClearingCache(false);
    }
  };

  const handleExport = async () => {
    const ok = await window.noctis.exportBackup();
    if (ok) setStatusMsg('Backup exported successfully.');
  };

  const handleImport = async () => {
    const ok = await window.noctis.importBackup();
    if (ok) {
      await refreshAllData();
      setStatusMsg('Backup restored.');
    }
  };

  const handleConnectAniList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setConnecting(true);
    setStatusMsg(null);
    try {
      await window.noctis.setAniListToken(tokenInput.trim());
      await refreshTracker();
      setTokenInput('');
      setStatusMsg('AniList connected! Chapter completions will now auto-sync.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Invalid AniList token');
    } finally {
      setConnecting(false);
    }
  };

  const handleLoadAniList = async () => {
    const items = await window.noctis.getAniListLists();
    setAnilistList(items);
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-3xl space-y-7 pb-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Customize your OLED reading sanctuary, trackers, Discord presence, and backups.
          </p>
        </div>

        {statusMsg && (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">
            {statusMsg}
          </div>
        )}

        {/* AniList Two-Way Sync */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Link2 className="h-4 w-4 text-[#EAC278]" />
              <span>AniList Two-Way Tracker Sync</span>
            </div>
            <a
              href="https://anilist.co/settings/developer"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
            >
              <span>Developer Tokens</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {trackerConfig.anilistUser ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                <div className="flex items-center gap-3">
                  {trackerConfig.anilistUser.avatar && (
                    <img
                      src={trackerConfig.anilistUser.avatar}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <span>{trackerConfig.anilistUser.name}</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Auto-syncing completed chapters to AniList
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLoadAniList}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs text-white hover:bg-white/10 cursor-pointer"
                  >
                    Load My List
                  </button>
                  <button
                    onClick={async () => {
                      await window.noctis.disconnectAniList();
                      await refreshTracker();
                      setAnilistList([]);
                    }}
                    className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                  >
                    <Unlink className="h-3 w-3" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>

              {anilistList.length > 0 && (
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {anilistList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setCommandOpen(true)}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs hover:bg-white/[0.06] cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.cover && (
                          <img src={item.cover} alt="" className="h-9 w-6 rounded object-cover" />
                        )}
                        <span className="truncate text-zinc-200">{item.title}</span>
                      </div>
                      <span className="font-mono-tech text-[11px] text-zinc-400 shrink-0 ml-2">
                        {item.status} · Ch. {item.progress}/{item.totalChapters ?? '?'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleConnectAniList} className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste AniList Personal Access Token..."
                className="flex-1 min-w-[240px] rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={connecting || !tokenInput.trim()}
                className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-black disabled:opacity-40 cursor-pointer"
              >
                {connecting ? 'Verifying...' : 'Connect AniList'}
              </button>
            </form>
          )}
        </section>

        {/* Aesthetics, OLED & Integrations */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4 text-zinc-300" />
            <span>OLED Visuals, Reader & Integrations</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">Dynamic Cover Ambient Glow</div>
              <div className="text-xs text-zinc-500">
                Extracts cover palette for subtle atmospheric lighting on Home & Series Pages
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.ambientGlow}
              onChange={(e) => updateSettings({ ambientGlow: e.target.checked })}
              className="h-4 w-4 accent-white cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">OLED True-Black Ink Preset</div>
              <div className="text-xs text-zinc-500">
                Boosts black contrast so dark manga panels blend cleanly into #000000
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.oledInk}
              onChange={(e) => updateSettings({ oledInk: e.target.checked })}
              className="h-4 w-4 accent-white cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">Auto-Check Library Updates</div>
              <div className="text-xs text-zinc-500">
                Quietly checks saved series for newly released chapters on launch
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoCheckUpdates}
              onChange={(e) => updateSettings({ autoCheckUpdates: e.target.checked })}
              className="h-4 w-4 accent-white cursor-pointer"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-300" />
                <div>
                  <div className="text-sm text-zinc-200">Discord Rich Presence</div>
                  <div className="text-xs text-zinc-500">
                    Show currently reading series & chapter on your Discord profile
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.discordRpc}
                onChange={(e) => updateSettings({ discordRpc: e.target.checked })}
                className="h-4 w-4 accent-white cursor-pointer"
              />
            </div>

            {settings.discordRpc && (
              <div className="flex items-center justify-between pl-6">
                <div>
                  <div className="text-xs text-zinc-300">Discord Application Client ID</div>
                  <div className="text-[11px] text-zinc-500">
                    Create an app named KOMA at discord.com/developers to customize Rich Presence
                  </div>
                </div>
                <input
                  value={settings.discordClientId ?? ''}
                  onChange={(e) => updateSettings({ discordClientId: e.target.value.trim() })}
                  placeholder="Default (KOMA App ID)"
                  className="w-52 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 font-mono-tech text-xs text-white placeholder-zinc-600 focus:border-white/25 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">Preload Pages Ahead</div>
              <div className="text-xs text-zinc-500">
                Upcoming pages pre-decoded onto GPU while reading
              </div>
            </div>
            <select
              value={settings.preloadCount}
              onChange={(e) => updateSettings({ preloadCount: Number(e.target.value) })}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              {[2, 4, 6, 8, 12].map((n) => (
                <option key={n} value={n} className="bg-zinc-950">
                  {n} pages
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Content & Languages */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldAlert className="h-4 w-4 text-zinc-300" />
            <span>Sources & Content</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">Show 18+ / NSFW Sources</div>
              <div className="text-xs text-zinc-500">
                Include adult-marked extensions in Explore and Sources directory
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.showNsfw}
              onChange={(e) => updateSettings({ showNsfw: e.target.checked })}
              className="h-4 w-4 accent-white cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">Preferred Source Languages</div>
              <div className="text-xs text-zinc-500">
                Comma-separated ISO codes (en, fr, ar)
              </div>
            </div>
            <input
              value={settings.preferredLanguages.join(', ')}
              onChange={(e) =>
                updateSettings({
                  preferredLanguages: e.target.value
                    .split(',')
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean),
                })
              }
              className="w-40 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 font-mono-tech text-xs text-white focus:outline-none"
            />
          </div>
        </section>

        {/* Backup & Engine */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <div className="text-sm font-semibold text-white">Backup & Engine Diagnostics</div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <DownloadCloud className="h-3.5 w-3.5" />
              <span>Export Backup (.json)</span>
            </button>

            <button
              onClick={handleImport}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Restore Backup</span>
            </button>

            <button
              onClick={refreshEngine}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Restart Parser Engine</span>
            </button>

            <button
              onClick={handleClearCache}
              disabled={clearingCache || !engineStatus.ready}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 text-zinc-300" />
              <span>
                Clear Image Cache
                {cacheStats
                  ? ` (${(cacheStats.bytes / (1024 * 1024)).toFixed(1)} MB · ${cacheStats.files})`
                  : ''}
              </span>
            </button>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/50 p-4 font-mono-tech text-[11px] text-zinc-400 space-y-1">
            <div>Engine Status: {engineStatus.ready ? 'ONLINE' : 'OFFLINE'}</div>
            <div>Local Endpoint: {engineStatus.url ?? '—'}</div>
            <div>Verified Sources: {engineStatus.sourcesCount}</div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3 w-3 text-zinc-500" />
              <span>
                SSD Image Cache (1.5 GB auto-LRU cap):{' '}
                {cacheStats
                  ? `${(cacheStats.bytes / (1024 * 1024)).toFixed(1)} MB across ${cacheStats.files} files`
                  : 'Checking...'}
              </span>
            </div>
            {engineStatus.error && <div className="text-rose-400">Error: {engineStatus.error}</div>}
          </div>
        </section>

        {/* App Updates, Version & Walkthrough */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ArrowUpCircle className="h-4 w-4 text-[#EAC278]" />
              <span>App Updates & Version</span>
            </div>
            <span className="rounded-full border border-[#EAC278]/30 bg-[#EAC278]/10 px-3 py-1 font-mono-tech text-xs text-[#EAC278]">
              Installed: v{appVersion}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-200">GitHub Releases Repository</div>
              <div className="text-xs text-zinc-500">
                Checks GitHub Releases for new Windows (.exe) & Android (.apk) builds
              </div>
            </div>
            <input
              value={settings.githubRepo ?? 'nourddinachi20-rgb/KOMA'}
              onChange={(e) => void updateSettings({ githubRepo: e.target.value.trim() })}
              placeholder="owner/repo"
              className="w-56 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 font-mono-tech text-xs text-white focus:border-white/25 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void checkForAppUpdate(false)}
              disabled={checkingAppUpdate}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
            >
              {checkingAppUpdate ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>{checkingAppUpdate ? 'Checking...' : 'Check for Updates'}</span>
            </button>

            {appUpdateInfo?.hasUpdate && appUpdateInfo.downloadUrl && (
              <button
                onClick={() => void installAppUpdate()}
                disabled={Boolean(appUpdateProgress && appUpdateProgress.status !== 'error')}
                className="flex items-center gap-2 rounded-full bg-[#EAC278] px-5 py-2 text-xs font-semibold text-black shadow-[0_0_24px_rgba(234,194,120,0.3)] transition hover:brightness-105 cursor-pointer"
              >
                <DownloadCloud className="h-3.5 w-3.5" />
                <span>
                  Update to v{appUpdateInfo.latestVersion} &amp; Restart
                </span>
              </button>
            )}

            <button
              onClick={() => setShowWhatsNew(true)}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#EAC278]" />
              <span>What&apos;s New (v{appVersion})</span>
            </button>

            <button
              onClick={replayTutorial}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-zinc-300" />
              <span>Interactive Tutorial</span>
            </button>
          </div>

          {appUpdateProgress && (
            <div className="space-y-2 rounded-2xl border border-[#EAC278]/30 bg-[#EAC278]/[0.06] p-4">
              <div className="flex items-center justify-between text-xs text-white">
                <span>
                  {appUpdateProgress.status === 'installing'
                    ? 'Installing update & restarting KOMA...'
                    : appUpdateProgress.status === 'error'
                      ? appUpdateProgress.message || 'Update failed'
                      : 'Downloading update package...'}
                </span>
                <span className="font-mono-tech">{appUpdateProgress.percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  style={{ width: `${appUpdateProgress.percent}%` }}
                  className="h-full bg-[#EAC278] transition-all"
                />
              </div>
            </div>
          )}

          {appUpdateInfo && (
            <div className="rounded-2xl border border-white/[0.06] bg-black/50 p-4 font-mono-tech text-[11px] text-zinc-400 space-y-1">
              <div>
                Latest GitHub Release: {appUpdateInfo.releaseName} (v{appUpdateInfo.latestVersion})
              </div>
              <div>
                Status:{' '}
                {appUpdateInfo.hasUpdate
                  ? 'Update ready to install'
                  : appUpdateInfo.error
                    ? appUpdateInfo.error
                    : 'Up to date'}
              </div>
              {appUpdateInfo.assetName && (
                <div>
                  Package: {appUpdateInfo.assetName}{' '}
                  {appUpdateInfo.assetSize
                    ? `(${(appUpdateInfo.assetSize / (1024 * 1024)).toFixed(1)} MB)`
                    : ''}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="pb-6 text-center font-mono-tech text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          KOMA Sanctuary · Crafted by <span className="text-[#EAC278]">VirtualDrum</span>
        </div>
      </div>
    </div>
  );
}
