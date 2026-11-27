import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpCircle,
  BookOpen,
  CheckCircle2,
  DownloadCloud,
  ExternalLink,
  Globe,
  HardDrive,
  Link2,
  Loader2,
  Palette,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Unlink,
  UploadCloud,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { UiLanguage, UiTheme } from '../types';
import { useT } from '../utils/i18n';
import { ACCENT_PRESETS } from '../utils/theme';

export function SettingsView() {
  const t = useT();
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
          <h1 className="text-2xl font-bold tracking-tight text-white">{t.settings.title}</h1>
          <p className="mt-1 text-xs text-zinc-500">{t.settings.subtitle}</p>
        </div>

        {statusMsg && (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">
            {statusMsg}
          </div>
        )}

        {/* Language / Langue / اللغة */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Globe className="h-4 w-4 accent-fg" />
              <span>{t.settings.languageTitle}</span>
            </div>
            <span className="font-mono-tech text-[11px] text-zinc-500">
              {t.settings.moreLanguagesNote}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-200">{t.settings.languageLabel}</div>
              <div className="text-xs text-zinc-500">{t.settings.languageDesc}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'en', label: 'English' },
                  { id: 'fr', label: 'Français' },
                  { id: 'ar', label: 'العربية' },
                ] as Array<{ id: UiLanguage; label: string }>
              ).map((opt) => {
                const active = (settings.uiLanguage ?? 'en') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => void updateSettings({ uiLanguage: opt.id })}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'accent-bg border-white/40'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Appearance & Theme Customization */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Palette className="h-4 w-4 accent-fg" />
              <span>{t.settings.appearanceTitle}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                void updateSettings({ uiTheme: 'oled', accentColor: '#FFFFFF' })
              }
              className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] text-zinc-300 hover:border-white/30 hover:text-white cursor-pointer"
            >
              {t.settings.resetBw}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-200">{t.settings.themeLabel}</div>
              <div className="text-xs text-zinc-500">{t.settings.themeDesc}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'oled', label: t.settings.themeOled },
                  { id: 'dark', label: t.settings.themeDark },
                  { id: 'paper', label: t.settings.themePaper },
                ] as Array<{ id: UiTheme; label: string }>
              ).map((themeOpt) => {
                const active = (settings.uiTheme ?? 'oled') === themeOpt.id;
                return (
                  <button
                    key={themeOpt.id}
                    type="button"
                    onClick={() => void updateSettings({ uiTheme: themeOpt.id })}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'accent-bg border-white/40'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {themeOpt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
            <div>
              <div className="text-sm text-zinc-200">{t.settings.accentLabel}</div>
              <div className="text-xs text-zinc-500">{t.settings.accentDesc}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((preset) => {
                const active =
                  (settings.accentColor ?? '#FFFFFF').toUpperCase() === preset.hex;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    onClick={() => void updateSettings({ accentColor: preset.hex })}
                    className={`h-7 w-7 rounded-full border transition cursor-pointer ${
                      active ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black' : 'border-white/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  />
                );
              })}

              <label
                title={t.settings.customColor}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white cursor-pointer"
              >
                <input
                  type="color"
                  value={settings.accentColor || '#FFFFFF'}
                  onChange={(e) =>
                    void updateSettings({ accentColor: e.target.value.toUpperCase() })
                  }
                  className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                />
                <span>{t.settings.customColor}</span>
              </label>
            </div>
          </div>
        </section>

        {/* AniList Two-Way Sync */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Link2 className="h-4 w-4 accent-fg" />
              <span>{t.settings.anilistTitle}</span>
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
            <span>{t.settings.readerVisualsTitle}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">{t.settings.ambientGlow}</div>
              <div className="text-xs text-zinc-500">{t.settings.ambientGlowDesc}</div>
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
              <div className="text-sm text-zinc-200">{t.settings.oledInk}</div>
              <div className="text-xs text-zinc-500">{t.settings.oledInkDesc}</div>
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
              <div className="text-sm text-zinc-200">{t.settings.autoCheckUpdates}</div>
              <div className="text-xs text-zinc-500">{t.settings.autoCheckUpdatesDesc}</div>
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
                  <div className="text-sm text-zinc-200">{t.settings.discordRpc}</div>
                  <div className="text-xs text-zinc-500">{t.settings.discordRpcDesc}</div>
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
              <div className="text-sm text-zinc-200">{t.settings.preloadPages}</div>
              <div className="text-xs text-zinc-500">{t.settings.preloadPagesDesc}</div>
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
            <span>{t.settings.sourcesContentTitle}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">{t.settings.showNsfw}</div>
              <div className="text-xs text-zinc-500">{t.settings.showNsfwDesc}</div>
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
              <div className="text-sm text-zinc-200">{t.settings.sourceLangs}</div>
              <div className="text-xs text-zinc-500">{t.settings.sourceLangsDesc}</div>
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
          <div className="text-sm font-semibold text-white">{t.settings.backupEngineTitle}</div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <DownloadCloud className="h-3.5 w-3.5" />
              <span>{t.settings.exportBackup}</span>
            </button>

            <button
              onClick={handleImport}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>{t.settings.restoreBackup}</span>
            </button>

            <button
              onClick={refreshEngine}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t.settings.restartEngine}</span>
            </button>

            <button
              onClick={handleClearCache}
              disabled={clearingCache || !engineStatus.ready}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 text-zinc-300" />
              <span>
                {t.settings.clearCache}
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
              <ArrowUpCircle className="h-4 w-4 accent-fg" />
              <span>{t.settings.updatesVersionTitle}</span>
            </div>
            <span className="accent-pill rounded-full border px-3 py-1 font-mono-tech text-xs">
              {t.settings.installed}: v{appVersion}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-200">{t.settings.githubRepo}</div>
              <div className="text-xs text-zinc-500">{t.settings.githubRepoDesc}</div>
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
              className="accent-bg flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              {checkingAppUpdate ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>
                {checkingAppUpdate ? t.settings.checkingUpdates : t.settings.checkForUpdates}
              </span>
            </button>

            {appUpdateInfo?.hasUpdate && appUpdateInfo.downloadUrl && (
              <button
                onClick={() => void installAppUpdate()}
                disabled={Boolean(appUpdateProgress && appUpdateProgress.status !== 'error')}
                className="accent-bg flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold shadow-[0_0_24px_rgba(var(--koma-accent-rgb),0.25)] transition hover:brightness-105 cursor-pointer"
              >
                <DownloadCloud className="h-3.5 w-3.5" />
                <span>
                  {t.settings.updateAndRestart} (v{appUpdateInfo.latestVersion})
                </span>
              </button>
            )}

            <button
              onClick={() => setShowWhatsNew(true)}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 accent-fg" />
              <span>
                {t.settings.whatsNew} (v{appVersion})
              </span>
            </button>

            <button
              onClick={replayTutorial}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-zinc-300" />
              <span>{t.settings.interactiveTutorial}</span>
            </button>
          </div>

          {appUpdateProgress && (
            <div className="accent-pill space-y-2 rounded-2xl border p-4">
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
                  style={{
                    width: `${appUpdateProgress.percent}%`,
                    backgroundColor: 'var(--koma-accent, #FFFFFF)',
                  }}
                  className="h-full transition-all"
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
          KOMA · <span className="accent-fg font-semibold">VirtualDrum</span>
        </div>
      </div>
    </div>
  );
}
