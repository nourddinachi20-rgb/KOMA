import { useMemo } from 'react';
import { Bell, Download, Loader2, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getProxiedImageUrl } from '../utils/api';
import { useT } from '../utils/i18n';

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((today - target) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Earlier';
}

export function UpdatesView() {
  const t = useT();
  const {
    updates,
    checkingUpdates,
    checkLibraryUpdates,
    clearUpdates,
    openManga,
    openReader,
    queueDownload,
    downloads,
    downloadProgress,
    engineStatus,
  } = useAppStore();

  const labelMap: Record<string, string> = {
    Today: t.updates.today,
    Yesterday: t.updates.yesterday,
    'This Week': t.updates.thisWeek,
    Earlier: t.updates.earlier,
  };

  const grouped = useMemo(() => {
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    const map = new Map<string, typeof updates>();
    for (const u of updates) {
      const lbl = dayLabel(u.discoveredAt);
      const list = map.get(lbl) ?? [];
      list.push(u);
      map.set(lbl, list);
    }
    return order
      .map((label) => ({ label: labelMap[label] ?? label, items: map.get(label) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [updates, t.updates.today, t.updates.yesterday, t.updates.thisWeek, t.updates.earlier]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t.updates.title}</h1>
          <p className="font-mono-tech text-xs text-zinc-500">
            {updates.length} {t.updates.chaptersDiscovered}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {updates.length > 0 && (
            <button
              onClick={clearUpdates}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-zinc-300 transition hover:border-white/25 hover:text-white cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t.updates.clearFeed}</span>
            </button>
          )}

          <button
            onClick={() => void checkLibraryUpdates()}
            disabled={checkingUpdates}
            className="accent-bg flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            {checkingUpdates ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>{checkingUpdates ? t.updates.checking : t.updates.checkUpdates}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {grouped.length > 0 ? (
          <div className="mx-auto max-w-5xl space-y-8">
            {grouped.map((group) => (
              <section key={group.label}>
                <h2 className="mb-3 font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">
                  {group.label} ({group.items.length})
                </h2>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const cover = getProxiedImageUrl(
                      engineStatus.url,
                      item.manga.source,
                      item.manga.coverUrl || item.manga.largeCoverUrl,
                    );
                    const dlKey = `${item.manga.source}::${item.manga.id}::${item.chapter.id}`;
                    const downloaded = downloads.some((d) => d.key === dlKey);
                    const prog = downloadProgress[dlKey];
                    const chapters = item.manga.chapters ?? [item.chapter];
                    const chIdx = Math.max(
                      0,
                      chapters.findIndex((c) => c.id === item.chapter.id),
                    );

                    return (
                      <div
                        key={item.id}
                        className="cv-chapter flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 transition hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        <div
                          onClick={() => openManga(item.manga)}
                          className="flex min-w-0 flex-1 items-center gap-3.5 cursor-pointer"
                        >
                          <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
                            {cover && (
                              <img
                                src={cover}
                                alt=""
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {item.manga.title}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-zinc-300">
                              Ch. {item.chapter.number || ''}{' '}
                              {item.chapter.title ? `— ${item.chapter.title}` : ''}
                            </div>
                            <div className="mt-0.5 font-mono-tech text-[10px] text-zinc-500">
                              {item.manga.source} · {new Date(item.discoveredAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() =>
                              openReader({
                                manga: item.manga,
                                chapters,
                                chapterIndex: chIdx,
                              })
                            }
                            className="flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-black transition hover:scale-105 cursor-pointer"
                          >
                            <Play className="h-3.5 w-3.5 fill-black" />
                            <span>Read</span>
                          </button>

                          <button
                            onClick={() => {
                              if (!downloaded && !prog) void queueDownload(item.manga, item.chapter);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/25 hover:text-white cursor-pointer"
                            title={downloaded ? 'Downloaded' : 'Download'}
                          >
                            {prog ? (
                              <span className="font-mono-tech text-[9px]">
                                {Math.round((prog.done / Math.max(1, prog.total)) * 100)}%
                              </span>
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bell className="mb-3 h-8 w-8 text-zinc-600" />
            <p className="text-xl font-bold text-zinc-200">All Caught Up</p>
            <p className="mt-2 max-w-sm text-xs text-zinc-500">
              Click Check Updates to scan every series in your Library for newly released chapters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
