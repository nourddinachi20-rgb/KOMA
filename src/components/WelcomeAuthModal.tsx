import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
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
  const [formError, setFormError] = useState<string | null>(null);

  const visible =
    bootStage !== 'hydrating' && !syncSession && !settings.hasSeenWelcome;

  const validateCreds = (): boolean => {
    const clean = username.trim();
    if (clean.length < 3) {
      setFormError('Enter a username (at least 3 characters).');
      return false;
    }
    if (password.length < 6) {
      setFormError('Enter a password (at least 6 characters).');
      return false;
    }
    setFormError(null);
    return true;
  };

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
    if (!validateCreds()) return;
    try {
      await syncSignIn('', username, password);
      await finishWelcome();
      setPassword('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
      setFormError(msg);
      notify(msg, 'error');
    }
  };

  const handleCreateAccount = async () => {
    if (!validateCreds()) return;
    try {
      await syncCreateAccount('', username, password);
      await finishWelcome();
      setPassword('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Create account failed';
      setFormError(msg);
      notify(msg, 'error');
    }
  };

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="koma-welcome-page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease } }}
          className="fixed inset-0 z-[105] flex flex-col justify-between bg-black px-6 pt-safe pb-safe text-white select-none"
        >
          <div className="h-6 shrink-0" />

          <div className="mx-auto flex w-full max-w-[340px] flex-col items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease }}
            >
              <KomaLogo animated className="h-20 w-20" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32, ease }}
              className="mt-5 pl-[0.38em] text-2xl font-black tracking-[0.38em] text-white"
            >
              KOMA
            </motion.h1>

            <motion.form
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45, ease }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!syncBusy) void handleSignIn();
              }}
              className="mt-9 w-full space-y-3"
            >
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm text-white placeholder-zinc-500 transition focus:border-white/30 focus:bg-white/[0.07] focus:outline-none"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm text-white placeholder-zinc-500 transition focus:border-white/30 focus:bg-white/[0.07] focus:outline-none"
              />

              {formError && (
                <p role="alert" className="px-1 text-center text-xs text-rose-400">
                  {formError}
                </p>
              )}

              <div className="space-y-2.5 pt-2">
                <button
                  type="submit"
                  disabled={syncBusy}
                  className={`accent-bg inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-xs font-semibold leading-none tracking-wide transition hover:opacity-90 disabled:opacity-40 cursor-pointer ${
                    !username.trim() || !password ? 'opacity-65' : ''
                  }`}
                >
                  {syncBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={() => void handleCreateAccount()}
                  className={`inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-transparent py-3.5 text-xs font-medium leading-none tracking-wide text-zinc-200 transition hover:border-white/30 hover:text-white disabled:opacity-40 cursor-pointer ${
                    !username.trim() || !password ? 'opacity-65' : ''
                  }`}
                >
                  Create Account
                </button>
              </div>
            </motion.form>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="flex justify-center pb-6"
          >
            <button
              type="button"
              disabled={syncBusy}
              onClick={handleContinueAsGuest}
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-medium leading-none text-zinc-500 transition hover:text-white cursor-pointer"
            >
              Continue as Guest
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
