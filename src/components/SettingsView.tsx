import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DownloadCloud,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  Unlink,
  UploadCloud,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { UiLanguage, UiTheme } from '../types';
import { useT } from '../utils/i18n';
import { DEFAULT_SYNC_SERVER_URL } from '../utils/syncClient';
import { ACCENT_PRESETS } from '../utils/theme';
import { CustomSelect } from './CustomSelect';

type SectionKey = 'account' | 'appearance' | 'reader' | 'backup' | 'trackers' | 'about';

export function SettingsView() {
  const t = useT();
  const {
    settings,
    updateSettings,
    engineStatus,
    trackerConfig,
    refreshTracker,
    setCommandOpen,
    notify,
    restoreUnifiedBackup,
    syncSession,
    syncLastAt,
    syncBusy,
    syncCreateAccount,
    syncSignIn,
    syncPushNow,
    syncSignOut,
    appVersion,
    checkingAppUpdate,
    appUpdateInfo,
    appUpdateProgress,
    checkForAppUpdate,
    installAppUpdate,
    setShowWhatsNew,
    replayTutorial,
  } = useAppStore();

  const [openSection, setOpenSection] = useState<SectionKey | null>('appearance');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncServerInput, setSyncServerInput] = useState(() => settings.syncServerUrl ?? '');
  const [showCustomServer, setShowCustomServer] = useState(() =>
    Boolean(settings.syncServerUrl && settings.syncServerUrl !== DEFAULT_SYNC_SERVER_URL),
  );
  const [syncUserInput, setSyncUserInput] = useState(() => settings.syncUsername ?? '');
  const [syncPassInput, setSyncPassInput] = useState('');
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

  const toggle = (key: SectionKey) =>
    setOpenSection((cur) => (cur === key ? null : key));

  const handleClearCache = async () => {
    if (!engineStatus.url) return;
    setClearingCache(true);
    try {
      const res = await fetch(`${engineStatus.url}/api/cache/clear`, { method: 'POST' });
      const data = await res.json();
      setCacheStats({ files: 0, bytes: 0 });
      notify(`Cleared ${data.deleted ?? 0} cached images`, 'success');
    } catch {
      notify('Failed to clear cache', 'error');
    } finally {
      setClearingCache(false);
    }
  };

  const handleExport = async () => {
    const ok = await window.noctis.exportBackup();
    if (ok) setStatusMsg('Backup exported.');
  };

  const handleImport = async () => {
    setStatusMsg(null);
    try {
      const res = await restoreUnifiedBackup();
      if (!res.ok) return;
      const appName =
        res.format === 'kotatsu'
          ? 'Kotatsu'
          : res.format === 'mihon'
            ? 'Mihon / Komikku'
            : 'KOMA';
      const unmappedNote =
        res.unresolvedExternalCount && res.unresolvedExternalCount > 0
          ? ` (${res.unresolvedExternalCount} from unmapped sources — use Migrate Source on details if needed)`
          : '';
      setStatusMsg(
        `Restored ${appName}: ${res.libraryCount ?? 0} series, ${res.categoryCount ?? 0} categories, ${res.historyCount ?? 0} history items.${unmappedNote}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse backup file';
      notify(msg, 'error');
      setStatusMsg(msg);
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
      setStatusMsg('AniList connected.');
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

  const themeSummary =
    settings.uiTheme === 'paper'
      ? t.settings.themePaper
      : settings.uiTheme === 'dark'
        ? t.settings.themeDark
        : t.settings.themeOled;
  const langSummary =
    settings.uiLanguage === 'fr' ? 'Français' : settings.uiLanguage === 'ar' ? 'العربية' : 'English';

  const SectionHeader = ({
    id,
    title,
    summary,
  }: {
    id: SectionKey;
    title: string;
    summary: string;
  }) => {
    const isOpen = openSection === id;
    return (
      <button
        type="button"
        onClick={() => toggle(id)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02] cursor-pointer"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="truncate text-xs text-zinc-500">{summary}</div>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
        )}
      </button>
    );
  };

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-3 pb-16">
        <div className="mb-4 px-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">{t.settings.title}</h1>
        </div>

        {statusMsg && (
          <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-xs text-zinc-200">
            {statusMsg}
          </div>
        )}

        {/* 0. Account & Zero-Knowledge Encrypted Sync */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <SectionHeader
            id="account"
            title="Account & Sync"
            summary={
              syncSession
                ? `Signed in as ${syncSession.username}`
                : settings.syncUsername
                  ? `Saved user: ${settings.syncUsername} · Enter password to sync`
                  : 'Username + Password · Zero-Knowledge Encrypted'
            }
          />
          {openSection === 'account' && (
            <div className="space-y-4 border-t border-white/[0.06] px-5 py-4">
              <div className="rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-xs text-zinc-400">
                <strong className="text-white">End-to-End Encrypted:</strong> Your library and history are encrypted on your device using your password before syncing. No Google sign-in, no email, and the server cannot read your data.
              </div>

              {syncSession ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {syncSession.username}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {syncLastAt > 0
                          ? `Auto-sync active · Last synced ${new Date(syncLastAt).toLocaleTimeString()}`
                          : 'Auto-sync active across your devices'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={syncBusy}
                        onClick={() =>
                          void syncPushNow().catch((e) =>
                            notify(e instanceof Error ? e.message : 'Sync failed', 'error'),
                          )
                        }
                        className="accent-bg rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                      >
                        {syncBusy ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void syncSignOut()}
                        className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <input
                      value={syncUserInput}
                      onChange={(e) => setSyncUserInput(e.target.value)}
                      placeholder="Username (a-z, 0-9)"
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                    />
                    <input
                      type="password"
                      value={syncPassInput}
                      onChange={(e) => setSyncPassInput(e.target.value)}
                      placeholder="Password (min 6 chars)"
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  {(showCustomServer || !DEFAULT_SYNC_SERVER_URL) && (
                    <input
                      value={syncServerInput}
                      onChange={(e) => setSyncServerInput(e.target.value)}
                      placeholder={
                        DEFAULT_SYNC_SERVER_URL ||
                        'Sync Server URL (e.g. https://koma-zero-knowledge-sync...workers.dev)'
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                    />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={syncBusy || !syncUserInput.trim() || !syncPassInput}
                        onClick={() =>
                          void syncSignIn(syncServerInput, syncUserInput, syncPassInput)
                            .then(() => setSyncPassInput(''))
                            .catch((e) =>
                              notify(e instanceof Error ? e.message : 'Sign in failed', 'error'),
                            )
                        }
                        className="accent-bg rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                      >
                        {syncBusy ? 'Please wait...' : 'Sign In & Sync'}
                      </button>
                      <button
                        type="button"
                        disabled={syncBusy || !syncUserInput.trim() || !syncPassInput}
                        onClick={() =>
                          void syncCreateAccount(syncServerInput, syncUserInput, syncPassInput)
                            .then(() => setSyncPassInput(''))
                            .catch((e) =>
                              notify(e instanceof Error ? e.message : 'Register failed', 'error'),
                            )
                        }
                        className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                      >
                        Create Account
                      </button>
                    </div>
                    {DEFAULT_SYNC_SERVER_URL && (
                      <button
                        type="button"
                        onClick={() => setShowCustomServer((v) => !v)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                      >
                        {showCustomServer ? 'Hide custom server' : 'Use custom server'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 1. Appearance & Language */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <SectionHeader
            id="appearance"
            title={t.settings.appearanceTitle}
            summary={`${themeSummary} · ${langSummary}`}
          />
          {openSection === 'appearance' && (
            <div className="space-y-5 border-t border-white/[0.06] px-5 py-4">
              {/* Language */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-zinc-200">{t.settings.languageLabel}</div>
                  <span className="text-[11px] text-zinc-500">{t.settings.moreLanguagesNote}</span>
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

              {/* Theme */}
              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-zinc-200">{t.settings.themeLabel}</div>
                  <button
                    type="button"
                    onClick={() =>
                      void updateSettings({ uiTheme: 'oled', accentColor: '#FFFFFF' })
                    }
                    className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {t.settings.resetBw}
                  </button>
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

              {/* Accent Color */}
              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <div className="text-xs font-medium text-zinc-200">{t.settings.accentLabel}</div>
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
                          active
                            ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black'
                            : 'border-white/25 hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      />
                    );
                  })}

                  <label className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white cursor-pointer">
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
            </div>
          )}
        </section>

        {/* 2. Reader & Sources */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <SectionHeader
            id="reader"
            title={t.settings.readerVisualsTitle}
            summary={`${settings.preloadCount} pages preload · ${settings.preferredLanguages.join(', ')}`}
          />
          {openSection === 'reader' && (
            <div className="space-y-4 border-t border-white/[0.06] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
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

              <div className="flex items-center justify-between gap-4">
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

              <div className="flex items-center justify-between gap-4">
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

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-200">{t.settings.preloadPages}</div>
                  <div className="text-xs text-zinc-500">{t.settings.preloadPagesDesc}</div>
                </div>
                <CustomSelect
                  value={String(settings.preloadCount)}
                  onChange={(v) => updateSettings({ preloadCount: Number(v) })}
                  options={[2, 4, 6, 8, 12].map((n) => ({
                    value: String(n),
                    label: `${n} pages`,
                  }))}
                />
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
                <div>
                  <div className="text-sm text-zinc-200">Duplicate Chapters</div>
                  <div className="text-xs text-zinc-500">
                    Hide duplicate chapter uploads and keep only the latest version
                  </div>
                </div>
                <CustomSelect
                  value={settings.chapterDupMode ?? 'dedupe'}
                  onChange={(v) =>
                    updateSettings({ chapterDupMode: v as 'dedupe' | 'collapse' | 'all' })
                  }
                  options={[
                    { value: 'dedupe', label: 'Keep Latest Copy' },
                    { value: 'collapse', label: 'Collapse .x (Latest Only)' },
                    { value: 'all', label: 'Show All Uploads' },
                  ]}
                />
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
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

              <div className="flex items-center justify-between gap-4">
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
                  className="w-32 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          )}
        </section>

        {/* 3. Backup & Cache */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <SectionHeader
            id="backup"
            title="Backup & Storage"
            summary="KOMA (.json), Kotatsu (.bk), Mihon & Komikku (.tachibk)"
          />
          {openSection === 'backup' && (
            <div className="flex flex-wrap items-center gap-2.5 border-t border-white/[0.06] px-5 py-4">
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
                <span>{t.settings.restoreBackup} (.json / .bk / .tachibk)</span>
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
                    ? ` (${(cacheStats.bytes / (1024 * 1024)).toFixed(1)} MB)`
                    : ''}
                </span>
              </button>
            </div>
          )}
        </section>

        {/* 4. Trackers & Discord */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <SectionHeader
            id="trackers"
            title="AniList & Discord"
            summary={
              trackerConfig.anilistUser
                ? `Connected: ${trackerConfig.anilistUser.name}`
                : 'Optional progress sync'
            }
          />
          {openSection === 'trackers' && (
            <div className="space-y-4 border-t border-white/[0.06] px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-white">{t.settings.anilistTitle}</div>
                <a
                  href="https://anilist.co/settings/developer"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                >
                  <span>Tokens</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {trackerConfig.anilistUser ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center gap-3">
                      {trackerConfig.anilistUser.avatar && (
                        <img
                          src={trackerConfig.anilistUser.avatar}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                          <span>{trackerConfig.anilistUser.name}</span>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                        <div className="text-[11px] text-zinc-400">Auto-syncing</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleLoadAniList}
                        className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white hover:bg-white/10 cursor-pointer"
                      >
                        My List
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
                      </button>
                    </div>
                  </div>

                  {anilistList.length > 0 && (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                      {anilistList.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setCommandOpen(true)}
                          className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs hover:bg-white/[0.06] cursor-pointer"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            {item.cover && (
                              <img src={item.cover} alt="" className="h-8 w-5 rounded object-cover" />
                            )}
                            <span className="truncate text-zinc-200">{item.title}</span>
                          </div>
                          <span className="ml-2 shrink-0 text-[11px] text-zinc-400">
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
                    placeholder="Paste AniList token..."
                    className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={connecting || !tokenInput.trim()}
                    className="accent-bg rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    {connecting ? '...' : 'Connect'}
                  </button>
                </form>
              )}

              <div className="space-y-2.5 border-t border-white/[0.06] pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-zinc-200">{t.settings.discordRpc}</div>
                    <div className="text-xs text-zinc-500">{t.settings.discordRpcDesc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.discordRpc}
                    onChange={(e) => updateSettings({ discordRpc: e.target.checked })}
                    className="h-4 w-4 accent-white cursor-pointer"
                  />
                </div>
                {settings.discordRpc && (
                  <input
                    value={settings.discordClientId ?? ''}
                    onChange={(e) => updateSettings({ discordClientId: e.target.value.trim() })}
                    placeholder="Discord Client ID (optional)"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                  />
                )}
              </div>
            </div>
          )}
        </section>

        {/* 5. Updates, What's New & Tutorial (Clean — no GitHub or Engine noise) */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <SectionHeader
            id="about"
            title={t.settings.updatesVersionTitle}
            summary={`v${appVersion} · VirtualDrum`}
          />
          {openSection === 'about' && (
            <div className="space-y-4 border-t border-white/[0.06] px-5 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
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
                    className="accent-bg flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition hover:brightness-105 cursor-pointer"
                  >
                    <DownloadCloud className="h-3.5 w-3.5" />
                    <span>
                      {t.settings.updateAndRestart} (v{appUpdateInfo.latestVersion})
                    </span>
                  </button>
                )}

                <button
                  onClick={() => setShowWhatsNew(true)}
                  className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
                >
                  {t.settings.whatsNew} (v{appVersion})
                </button>

                <button
                  onClick={replayTutorial}
                  className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
                >
                  {t.settings.interactiveTutorial}
                </button>
              </div>

              {appUpdateProgress && (
                <div className="accent-pill space-y-2 rounded-2xl border p-4">
                  <div className="flex items-center justify-between text-xs text-white">
                    <span>
                      {appUpdateProgress.status === 'installing'
                        ? 'Installing update & restarting...'
                        : appUpdateProgress.status === 'error'
                          ? appUpdateProgress.message || 'Update failed'
                          : 'Downloading update...'}
                    </span>
                    <span>{appUpdateProgress.percent}%</span>
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
            </div>
          )}
        </section>

        <div className="pt-4 text-center text-[11px] tracking-[0.2em] text-zinc-500 uppercase">
          KOMA v{appVersion} · VirtualDrum
        </div>
      </div>
    </div>
  );
}
