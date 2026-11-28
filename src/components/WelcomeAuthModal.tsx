import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_SYNC_SERVER_URL } from '../utils/syncClient';
import { KomaLogo } from './KomaLogo';

export function WelcomeAuthModal() {
  const {
    bootStage,
    settings,
    syncSession,
    syncBusy,
    syncSignIn,
    syncCreateAccount,
    updateSettings,
    replayTutorial,
    notify,
  } = useAppStore();

  const [username, setUsername] = useState(settings.syncUsername ?? '');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState(settings.syncServerUrl ?? '');
  const [showCustomServer, setShowCustomServer] = useState(false);

  const visible =
    bootStage === 'ready' && !syncSession && !settings.hasSeenWelcome;

  const finishWelcome = async () => {
    await updateSettings({ hasSeenWelcome: true });
    if (!settings.hasCompletedTutorial) {
      replayTutorial();
    }
  };

  const handleContinueAsGuest = () => {
    void finishWelcome();
  };

  const handleSignIn = async () => {
    try {
      await syncSignIn(serverUrl, username, password);
      await finishWelcome();
      setPassword('');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Sign in failed', 'error');
    }
  };

  const handleCreateAccount = async () => {
    try {
      await syncCreateAccount(serverUrl, username, password);
      await finishWelcome();
      setPassword('');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Create account failed', 'error');
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="koma-welcome-auth"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[#09090D] p-6 shadow-2xl sm:p-7"
          >
            <div className="flex flex-col items-center text-center">
              <KomaLogo className="h-12 w-12" />
              <h1 className="mt-3 text-xl font-bold tracking-tight text-white">
                Welcome to KOMA
              </h1>
              <p className="mt-1 text-xs text-zinc-400">
                Sign in or create an encrypted account to sync your library across phone &amp; PC, or continue as a guest.
              </p>
            </div>

            <div className="mt-5 space-y-2.5">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (a-z, 0-9)"
                autoComplete="username"
                className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 chars)"
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
              />

              {(showCustomServer || !DEFAULT_SYNC_SERVER_URL) && (
                <input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder={DEFAULT_SYNC_SERVER_URL || 'Sync Server URL'}
                  className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                />
              )}
            </div>

            <div className="mt-5 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={syncBusy || !username.trim() || !password}
                  onClick={() => void handleSignIn()}
                  className="accent-bg inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold leading-none disabled:opacity-40 cursor-pointer"
                >
                  {syncBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  disabled={syncBusy || !username.trim() || !password}
                  onClick={() => void handleCreateAccount()}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2.5 text-xs font-semibold leading-none text-white hover:bg-white/12 disabled:opacity-40 cursor-pointer"
                >
                  <span>Create Account</span>
                </button>
              </div>

              <button
                type="button"
                disabled={syncBusy}
                onClick={handleContinueAsGuest}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-transparent px-4 py-2.5 text-xs font-medium leading-none text-zinc-400 transition hover:border-white/25 hover:text-white cursor-pointer"
              >
                Continue as Guest
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3.5 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span>Zero-knowledge encrypted · No email</span>
              </span>
              {DEFAULT_SYNC_SERVER_URL && (
                <button
                  type="button"
                  onClick={() => setShowCustomServer((v) => !v)}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showCustomServer ? 'Default server' : 'Custom server'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
