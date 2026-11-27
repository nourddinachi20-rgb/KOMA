import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function ToastContainer() {
  const { toasts, dismissToast } = useAppStore();

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[110] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon =
            t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertCircle : Info;
          const accent =
            t.tone === 'success'
              ? 'text-emerald-400'
              : t.tone === 'error'
                ? 'text-rose-400'
                : 'accent-fg';

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/12 bg-[#0b0b0f]/95 px-4 py-2.5 text-xs text-white shadow-[0_14px_40px_rgba(0,0,0,0.8)]"
            >
              <Icon className={`h-4 w-4 shrink-0 ${accent}`} />
              <span className="max-w-xs truncate">{t.message}</span>
              <button
                onClick={() => dismissToast(t.id)}
                className="ml-1 text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
