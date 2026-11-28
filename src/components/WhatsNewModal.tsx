import { AnimatePresence, motion } from 'framer-motion';
import { Bug, CheckCircle2, Sparkles, Wrench, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useT } from '../utils/i18n';
import { parseChangelogSections } from '../utils/releaseInfo';

export function WhatsNewModal() {
  const {
    bootStage,
    tutorialOpen,
    showWhatsNew,
    appVersion,
    settings,
    appUpdateInfo,
    dismissWhatsNew,
  } = useAppStore();
  const t = useT();

  const visible = bootStage === 'ready' && !tutorialOpen && showWhatsNew;
  const rawNotes = settings.pendingWhatsNewNotes || appUpdateInfo?.notes || '';
  const sections = parseChangelogSections(rawNotes);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/85 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#09090D] shadow-[0_32px_90px_rgba(0,0,0,0.95)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-white">
                  {t.whatsNew.titlePrefix} {appVersion}
                </h2>
              </div>
              <button
                onClick={() => void dismissWhatsNew()}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sectioned Release Notes */}
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {sections.map((sec) => {
                const Icon =
                  sec.tone === 'fixes' ? Bug : sec.tone === 'improvements' ? Wrench : Sparkles;
                const badgeColor =
                  sec.tone === 'fixes'
                    ? 'text-emerald-300 border-emerald-400/25 bg-emerald-400/10'
                    : sec.tone === 'improvements'
                      ? 'text-sky-300 border-sky-400/25 bg-sky-400/10'
                      : 'accent-pill';
                return (
                  <div
                    key={sec.title}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4"
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeColor}`}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{sec.title}</span>
                    </div>
                    <ul className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-300">
                      {sec.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/50" />
                          <span>{item.replace(/\*\*/g, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-white/[0.08] bg-black/40 px-6 py-4">
              <button
                onClick={() => void dismissWhatsNew()}
                className="accent-bg flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold transition cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{t.whatsNew.gotIt}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
