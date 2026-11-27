import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, HardDrive, Play, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { DownloadedChapter } from '../types';
import { getProxiedImageUrl } from '../utils/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadsView() {
  const { downloads, downloadProgress, deleteDownload, openReader, engineStatus, library, notify } =
    useAppStore();
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});

  const totalBytes = downloads.reduce((acc, d) => acc + d.sizeBytes, 0);
  const activeProgKeys = Object.keys(downloadProgress);

  const groupedSeries = useMemo(() => {
    const map = new Map<
      string,
      {
        seriesKey: string;
        source: string;
        mangaId: string;
        mangaTitle: string;
        coverUrl?: string;
        totalBytes: number;
        chapters: DownloadedChapter[];
      }
    >();

    for (const dl of downloads) {
      const sKey = `${dl.source}::${dl.mangaId}`;
      const existing = map.get(sKey);
      if (existing) {
        existing.chapters.push(dl);
        existing.totalBytes += dl.sizeBytes;
        if (!existing.coverUrl && dl.coverUrl) existing.coverUrl = dl.coverUrl;
      } else {
        map.set(sKey, {
          seriesKey: sKey,
          source: dl.source,
          mangaId: dl.mangaId,
          mangaTitle: dl.mangaTitle,
          coverUrl: dl.coverUrl,
          totalBytes: dl.sizeBytes,
          chapters: [dl],
        });
      }
    }

    return Array.from(map.values()).map((g) => ({
      ...g,
      chapters: [...g.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber),
    }));
  }, [downloads]);

  const handleDeleteSeries = async (chapters: DownloadedChapter[], title: string) => {
    for (const ch of chapters) {
      await deleteDownload(ch.key);
    }
    notify(`Removed offline chapters for "${title}"`, 'info');
  };

  const handleOpenOffline = (dl: (typeof downloads)[number]) => {
    const libEntry = library.find((l) => l.key === `${dl.source}::${dl.mangaId}`);
    const chapterObj = {
      id: dl.chapterId,
      title: dl.chapterTitle,
      number: dl.chapterNumber,
      volume: 0,
      url: dl.cbzPath,
      scanlator: 'Offline CBZ',
      uploadDate: dl.downloadedAt,
      branch: null,
      source: dl.source,
    };
    const mangaObj = libEntry?.manga ?? {
      id: dl.mangaId,
      title: dl.mangaTitle,
      altTitles: [],
      url: dl.cbzPath,
      publicUrl: '',
      rating: -1,
      contentRating: null,
      coverUrl: dl.coverUrl ?? null,
      largeCoverUrl: dl.coverUrl ?? null,
      state: null,
      authors: [],
      description: null,
      source: dl.source,
      tags: [],
      chapters: [chapterObj],
    };

    const chaptersForManga = downloads
      .filter((d) => d.source === dl.source && d.mangaId === dl.mangaId)
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map((d) => ({
        id: d.chapterId,
        title: d.chapterTitle,
        number: d.chapterNumber,
        volume: 0,
        url: d.cbzPath,
        scanlator: 'Offline CBZ',
        uploadDate: d.downloadedAt,
        branch: null,
        source: d.source,
      }));

    const idx = Math.max(
      0,
      chaptersForManga.findIndex((c) => c.id === dl.chapterId),
    );
    openReader({
      manga: mangaObj,
      chapters: chaptersForManga,
      chapterIndex: idx,
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Offline Sanctuary</h1>
          <p className="font-mono-tech text-xs text-zinc-500">
            {downloads.length} chapters cached · {formatBytes(totalBytes)} on disk
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeProgKeys.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-500">
              Active Downloads
            </h3>
            {activeProgKeys.map((k) => {
              const p = downloadProgress[k];
              const pct = Math.round((p.done / Math.max(1, p.total)) * 100);
              return (
                <div
                  key={k}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="font-mono-tech">{k}</span>
                    <span className="font-mono-tech">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-white transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {groupedSeries.length > 0 ? (
          <div className="space-y-4">
            {groupedSeries.map((series) => {
              const cover = getProxiedImageUrl(engineStatus.url, series.source, series.coverUrl);
              const isExpanded = Boolean(expandedSeries[series.seriesKey]);
              return (
                <div
                  key={series.seriesKey}
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]"
                >
                  <div className="flex flex-wrap items-center gap-4 p-3.5 transition hover:bg-white/[0.03]">
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
                      {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-white">
                        {series.mangaTitle}
                      </h3>
                      <p className="mt-1 font-mono-tech text-[11px] text-zinc-400">
                        {series.chapters.length} offline chapter{series.chapters.length === 1 ? '' : 's'} ·{' '}
                        {formatBytes(series.totalBytes)} · {series.source}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenOffline(series.chapters[0])}
                        className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:scale-105 cursor-pointer"
                        title="Read Offline"
                      >
                        <Play className="h-3.5 w-3.5 fill-black" />
                        <span>Read Ch. {series.chapters[0].chapterNumber || 1}</span>
                      </button>

                      <button
                        onClick={() =>
                          setExpandedSeries((prev) => ({
                            ...prev,
                            [series.seriesKey]: !prev[series.seriesKey],
                          }))
                        }
                        className="flex h-9 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-300 transition hover:border-white/25 hover:text-white cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        <span>Chapters</span>
                      </button>

                      <button
                        onClick={() => void handleDeleteSeries(series.chapters, series.mangaTitle)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-400 cursor-pointer"
                        title="Delete all offline chapters for this series"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="grid grid-cols-1 gap-2 border-t border-white/[0.06] bg-black/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {series.chapters.map((dl) => (
                        <div
                          key={dl.key}
                          className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                        >
                          <button
                            onClick={() => handleOpenOffline(dl)}
                            className="min-w-0 flex-1 pr-2 text-left cursor-pointer"
                          >
                            <div className="truncate text-xs font-medium text-white hover:underline">
                              Ch. {dl.chapterNumber || ''} {dl.chapterTitle ? `— ${dl.chapterTitle}` : ''}
                            </div>
                            <div className="font-mono-tech text-[10px] text-zinc-500">
                              {dl.pageCount} pages · {formatBytes(dl.sizeBytes)}
                            </div>
                          </button>
                          <button
                            onClick={() => deleteDownload(dl.key)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 hover:border-rose-500/40 hover:text-rose-400 cursor-pointer"
                            title="Delete CBZ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <HardDrive className="mb-3 h-8 w-8 text-zinc-600" />
            <p className="font-editorial text-3xl text-zinc-300">Zero Offline Chapters Yet</p>
            <p className="mt-2 max-w-sm text-xs text-zinc-500">
              Open any series and click Download on a chapter (or Download Next 5) to store crisp
              CBZ volumes locally for instant offline reading.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
