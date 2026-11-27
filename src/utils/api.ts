import type { FilterMetadata, Manga, MangaChapter, MangaPage, MangaTag, SortOrder, SourceInfo } from '../types';

export function getProxiedImageUrl(
  engineUrl: string | null,
  source: string | null | undefined,
  url: string | null | undefined,
): string {
  if (!url) return '';
  if (url.startsWith('noctis-cbz://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  // Wait for the local proxy engine rather than hotlinking raw external URLs before boot completes
  if (!engineUrl) return '';
  const params = new URLSearchParams();
  if (source) params.set('source', source);
  params.set('url', url);
  return `${engineUrl}/api/image?${params.toString()}`;
}

async function fetchWithCfRetry(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.ok) return res;
  const clone = res.clone();
  const errBody = (await clone.json().catch(() => null)) as {
    code?: string;
    challengeUrl?: string;
    error?: string;
  } | null;
  if (errBody?.code === 'CLOUDFLARE_REQUIRED' && errBody.challengeUrl) {
    const solved = await window.noctis.solveCloudflare(errBody.challengeUrl);
    if (solved.ok) {
      return fetch(url, init);
    }
  }
  return res;
}

export async function fetchSources(engineUrl: string, includeUnverified = false): Promise<SourceInfo[]> {
  const res = await fetch(`${engineUrl}/api/sources?includeUnverified=${includeUnverified}`);
  if (!res.ok) throw new Error(`Failed to fetch sources (${res.status})`);
  const data = (await res.json()) as { sources: SourceInfo[] };
  return data.sources;
}

export async function fetchSourceFilters(engineUrl: string, source: string): Promise<FilterMetadata> {
  const res = await fetchWithCfRetry(`${engineUrl}/api/sources/${encodeURIComponent(source)}/filters`);
  if (!res.ok) throw new Error(`Failed to load filters (${res.status})`);
  return (await res.json()) as FilterMetadata;
}

export async function updateSourceDomain(engineUrl: string, source: string, domain: string): Promise<string> {
  const res = await fetch(`${engineUrl}/api/sources/${encodeURIComponent(source)}/domain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) throw new Error('Failed to update domain');
  const data = (await res.json()) as { domain: string };
  return data.domain;
}

export async function fetchMangaList(
  engineUrl: string,
  source: string,
  opts: {
    offset?: number;
    order?: SortOrder;
    query?: string;
    tags?: MangaTag[];
    states?: string[];
  } = {},
): Promise<Manga[]> {
  const res = await fetchWithCfRetry(`${engineUrl}/api/sources/${encodeURIComponent(source)}/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offset: opts.offset ?? 0,
      order: opts.order,
      filter: {
        query: opts.query || undefined,
        tags: opts.tags?.length ? opts.tags : undefined,
        states: opts.states?.length ? opts.states : undefined,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch list (${res.status})`);
  }
  const data = (await res.json()) as { items: Manga[] };
  return data.items;
}

export async function fetchMangaDetails(engineUrl: string, manga: Manga): Promise<Manga> {
  const res = await fetchWithCfRetry(`${engineUrl}/api/sources/${encodeURIComponent(manga.source)}/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manga }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load details (${res.status})`);
  }
  const data = (await res.json()) as { manga: Manga };
  return data.manga;
}

export async function fetchChapterPages(engineUrl: string, chapter: MangaChapter): Promise<MangaPage[]> {
  const res = await fetchWithCfRetry(`${engineUrl}/api/sources/${encodeURIComponent(chapter.source)}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load pages (${res.status})`);
  }
  const data = (await res.json()) as { pages: MangaPage[] };
  return data.pages;
}

export async function searchAcrossSources(
  engineUrl: string,
  query: string,
  sources: string[],
): Promise<Array<{ source: string; sourceTitle: string; items: Manga[] }>> {
  const res = await fetch(`${engineUrl}/api/search-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, sources }),
  });
  if (!res.ok) throw new Error('Global search failed');
  const data = (await res.json()) as {
    results: Array<{ source: string; sourceTitle: string; items: Manga[] }>;
  };
  return data.results;
}
