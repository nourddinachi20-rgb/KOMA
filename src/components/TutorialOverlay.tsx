import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Download,
  Library,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { NavView } from '../types';
import { useT } from '../utils/i18n';

interface TourStep {
  id: string;
  title: string;
  badge: string;
  description: string;
  highlights: string[];
  targetView: NavView;
  icon: typeof Sparkles;
  quickActionLabel?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'explore',
    title: 'Sources & Search',
    badge: 'BROWSE',
    description:
      'Browse catalogs by language or use Ctrl+K / Search to query pinned sources together.',
    highlights: [
      'Pin or unpin your favorite sources from Settings → Sources',
      'Open Cloudflare unlock on any gated source directly from Settings → Sources',
      'Tap Related or Recommended titles on a manga page to search across sources',
    ],
    targetView: 'explore',
    icon: Compass,
    quickActionLabel: 'Open Search (Ctrl+K)',
  },
  {
    id: 'library',
    title: 'Library, Shelves & Offline CBZ',
    badge: 'LIBRARY',
    description:
      'Keep your reading progress, shelves, statistics, and offline CBZ downloads in one place.',
    highlights: [
      'Import Kotatsu (.bk/.zip), Mihon/Komikku (.tachibk), KOMA (.json), or local .cbz files',
      'Use Migrate Source on broken series to keep shelves and chapter progress',
      'Filter by shelf, unread count, or sort by Last Read / Title',
    ],
    targetView: 'library',
    icon: Library,
  },
  {
    id: 'reader',
    title: 'Reader & Sync',
    badge: 'READER',
    description:
      'Reads Webtoon strip, RTL manga, LTR, and double-page spreads with per-series preferences.',
    highlights: [
      'Sign in under Settings → Account & Sync to sync shelves, history, and stats across devices',
      'Auto-marks chapters read past 85% and optionally syncs progress to AniList',
      'Switch theme (Pure Black / Dark Slate / Light Paper) and language (EN / FR / AR) in Settings',
    ],
    targetView: 'settings',
    icon: BookOpen,
  },
];

export function TutorialOverlay() {
  const {
    bootStage,
    tutorialOpen,
    settings,
    syncSession,
    setActiveView,
    closeManga,
    setCommandOpen,
    completeTutorial,
  } = useAppStore();

  const t = useT();
  const [stepIdx, setStepIdx] = useState(0);

  const visible =
    bootStage === 'ready' &&
    tutorialOpen &&
    Boolean(settings.hasSeenWelcome || syncSession);
  const step = TOUR_STEPS[stepIdx] ?? TOUR_STEPS[0];
  const Icon = step.icon;
  const isLast = stepIdx === TOUR_STEPS.length - 1;

  // Live preview the corresponding tab cleanly as the user walks the tour
  useEffect(() => {
    if (!visible) return;
    closeManga();
    setActiveView(step.targetView);
  }, [visible, stepIdx, step.targetView, closeManga, setActiveView]);

  const handleFinish = async () => {
    setActiveView('home');
    await completeTutorial();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-4 sm:items-center"
        >
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-[#09090E]/95 shadow-[0_30px_90px_rgba(0,0,0,0.95)]"
          >
            {/* Top Step Progress Rail */}
            <div className="h-[3px] w-full bg-white/[0.06]">
              <div
                style={{
                  width: `${((stepIdx + 1) / TOUR_STEPS.length) * 100}%`,
                  backgroundColor: 'var(--koma-accent, #FFFFFF)',
                }}
                className="h-full transition-all duration-300"
              />
            </div>

            <div className="p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div className="accent-pill inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono-tech text-[10px] font-semibold uppercase tracking-[0.2em]">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{step.badge}</span>
                </div>
                <span className="font-mono-tech text-xs text-zinc-500">
                  {stepIdx + 1} / {TOUR_STEPS.length}
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{step.description}</p>

              <ul className="mt-4 space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-xs text-zinc-300">
                {step.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: 'var(--koma-accent, #FFFFFF)' }}
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              {step.quickActionLabel && (
                <button
                  onClick={() => setCommandOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5 accent-fg" />
                  <span>{step.quickActionLabel}</span>
                </button>
              )}

              {/* Navigation Controls */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => void handleFinish()}
                  className="text-xs text-zinc-500 transition hover:text-zinc-200 cursor-pointer"
                >
                  {t.tutorial.skip}
                </button>

                <div className="flex items-center gap-1.5">
                  {TOUR_STEPS.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => setStepIdx(idx)}
                      aria-label={`Step ${idx + 1}`}
                      style={
                        idx === stepIdx
                          ? { backgroundColor: 'var(--koma-accent, #FFFFFF)' }
                          : undefined
                      }
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === stepIdx ? 'w-6' : 'w-1.5 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {stepIdx > 0 && (
                    <button
                      onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>{t.tutorial.back}</span>
                    </button>
                  )}

                  {isLast ? (
                    <button
                      onClick={() => void handleFinish()}
                      className="accent-bg flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold shadow-[0_0_25px_rgba(var(--koma-accent-rgb),0.25)] transition hover:scale-[1.02] cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{t.tutorial.enter}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setStepIdx((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
                      className="accent-bg flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold transition cursor-pointer"
                    >
                      <span>{t.tutorial.next}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
