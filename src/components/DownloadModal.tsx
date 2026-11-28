import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Download, X } from 'lucide-react';
import type { DownloadedChapter, Manga, MangaChapter } from '../types';

interface DownloadModalProps {
  open: boolean;
  manga: Manga;
  chapters: MangaChapter[];
  readChapterIds: Set<string>;
  downloads: DownloadedChapter[];
  onClose: () => void;
  onQueueChapters: (chapters: MangaChapter[]) => Promise<void>;
}

export function DownloadModal({
  open,
  manga,
  chapters,
  readChapterIds,
  downloads,
  onClose,
  onQueueChapters,
}: DownloadModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState(() => String(chapters.length || 1));

  const downloadedIds = useMemo(() => {
    const prefix = `${manga.source}::${manga.id}::`;
    return new Set(
      downloads.filter((d) => d.key.startsWith(prefix)).map((d) => d.chapterId),
    );
  }, [downloads, manga.id, manga.source]);

  const unreadChapters = useMemo(
    () => chapters.filter((ch) => !readChapterIds.has(ch.id) && !downloadedIds.has(ch.id)),
    [chapters, readChapterIds, downloadedIds],
  );

  const undownloadedChapters = useMemo(
    () => chapters.filter((ch) => !downloadedIds.has(ch.id)),
    [chapters, downloadedIds],
  );

  const queueAndClose = async (list: MangaChapter[]) => {
    if (list.length === 0) return;
    onClose();
    await onQueueChapters(list);
  };

  const handleDownloadRange = () => {
    const a = Number(rangeStart);
    const b = Number(rangeEnd);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const matches = chapters.filter((ch, idx) => {
      const n = ch.number > 0 ? ch.number : idx + 1;
      return n >= min && n <= max && !downloadedIds.has(ch.id);
    });
    void queueAndClose(matches);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-[#09090D] sm:rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">Download Chapters</h2>
                <p className="truncate text-xs text-zinc-400">{manga.title}</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Quick Options */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={unreadChapters.length === 0}
                  onClick={() => void queueAndClose(unreadChapters)}
                  className="flex flex-col items-start rounded-2xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-left transition hover:border-white/30 hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-white">Unread Chapters</span>
                  <span className="text-[11px] text-zinc-400">{unreadChapters.length} chapters</span>
                </button>

                <button
                  type="button"
                  disabled={undownloadedChapters.length === 0}
                  onClick={() => void queueAndClose(undownloadedChapters)}
                  className="flex flex-col items-start rounded-2xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-left transition hover:border-white/30 hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-white">All Chapters</span>
                  <span className="text-[11px] text-zinc-400">{undownloadedChapters.length} chapters</span>
                </button>

                <button
                  type="button"
                  disabled={unreadChapters.length === 0}
                  onClick={() => void queueAndClose(unreadChapters.slice(0, 5))}
                  className="flex flex-col items-start rounded-2xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-left transition hover:border-white/30 hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-white">Next 5 Unread</span>
                  <span className="text-[11px] text-zinc-400">
                    {Math.min(5, unreadChapters.length)} chapters
                  </span>
                </button>

                <button
                  type="button"
                  disabled={unreadChapters.length === 0}
                  onClick={() => void queueAndClose(unreadChapters.slice(0, 10))}
                  className="flex flex-col items-start rounded-2xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-left transition hover:border-white/30 hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-white">Next 10 Unread</span>
                  <span className="text-[11px] text-zinc-400">
                    {Math.min(10, unreadChapters.length)} chapters
                  </span>
                </button>
              </div>

              {/* Chapter Range */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-white">Range by Chapter Number</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    placeholder="From"
                    className="w-24 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                  />
                  <span className="text-xs text-zinc-500">to</span>
                  <input
                    type="number"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    placeholder="To"
                    className="w-24 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleDownloadRange}
                    className="accent-bg ml-auto rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    Download Range
                  </button>
                </div>
              </div>

              {/* Custom Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Custom Selection</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(unreadChapters.map((c) => c.id)))}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Select Unread
                    </button>
                    <span className="text-zinc-600">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-white/[0.08] bg-black/40 p-2">
                  {chapters.map((ch, idx) => {
                    const already = downloadedIds.has(ch.id);
                    const checked = selectedIds.has(ch.id);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        disabled={already}
                        onClick={() => toggleOne(ch.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                          already
                            ? 'opacity-40'
                            : checked
                              ? 'bg-white/12 text-white'
                              : 'text-zinc-300 hover:bg-white/[0.05]'
                        } cursor-pointer`}
                      >
                        <span className="truncate pr-2">
                          {ch.number >= 0 ? `Ch. ${ch.number}` : `Ch. ${idx + 1}`}
                          {ch.title ? ` — ${ch.title}` : ''}
                        </span>
                        {already ? (
                          <span className="text-[10px] text-zinc-500">Saved</span>
                        ) : (
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              checked
                                ? 'accent-bg border-white/40'
                                : 'border-white/25'
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] bg-black/50 px-5 py-3.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/15 px-4 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() =>
                  void queueAndClose(chapters.filter((c) => selectedIds.has(c.id)))
                }
                className="accent-bg flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Selected ({selectedIds.size})</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
