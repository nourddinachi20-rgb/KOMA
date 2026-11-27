import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface AniListUser {
  id: number;
  name: string;
  avatar?: string;
}

export interface TrackerConfig {
  anilistToken?: string;
  anilistUser?: AniListUser;
}

export interface AniListMediaInfo {
  id: number;
  title: string;
  bannerImage?: string;
  coverImage?: string;
  averageScore?: number;
  popularity?: number;
  chapters?: number;
  status?: string;
  siteUrl?: string;
  relations: Array<{ id: number; title: string; relationType: string; format: string; cover?: string }>;
  recommendations: Array<{ id: number; title: string; cover?: string; score?: number }>;
}

interface AniListRawMedia {
  id: number;
  format?: string;
  siteUrl?: string;
  title?: { english?: string; romaji?: string };
  bannerImage?: string;
  coverImage?: { extraLarge?: string; large?: string };
  averageScore?: number;
  popularity?: number;
  chapters?: number;
  status?: string;
  relations?: {
    edges?: Array<{
      relationType: string;
      node?: {
        id: number;
        format: string;
        title?: { english?: string; romaji?: string };
        coverImage?: { large?: string };
      };
    }>;
  };
  recommendations?: {
    nodes?: Array<{
      mediaRecommendation?: {
        id: number;
        averageScore?: number;
        title?: { english?: string; romaji?: string };
        coverImage?: { large?: string };
      };
    }>;
  };
}

function stripTitleNoise(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/\s*\{[^}]*\}\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-:|·]+$/g, '')
    .trim();
}

function buildTitleCandidates(title: string, altTitle?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (candidate: string) => {
    const c = candidate.trim();
    if (!c || c.length < 2) return;
    const lower = c.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      out.push(c);
    }
  };

  add(stripTitleNoise(title));
  add(title);

  if (altTitle) {
    for (const part of altTitle.split(/[·/|;\n]+/)) {
      const cleaned = stripTitleNoise(part);
      add(cleaned);
    }
  }

  return out.slice(0, 5);
}

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const metadataCache = new Map<string, AniListMediaInfo | null>();

class TrackerManager {
  private get filePath(): string {
    const dir = path.join(app.getPath('userData'), 'noctis-data');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'tracker.json');
  }

  getConfig(): TrackerConfig {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as TrackerConfig;
    } catch {
      return {};
    }
  }

  private saveConfig(cfg: TrackerConfig): TrackerConfig {
    fs.writeFileSync(this.filePath, JSON.stringify(cfg, null, 2), 'utf8');
    return cfg;
  }

  private async gql<T>(
    query: string,
    variables: Record<string, unknown>,
    token?: string,
  ): Promise<T | null> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  }

  async setAniListToken(token: string): Promise<TrackerConfig> {
    const clean = token.trim();
    if (!clean) return this.disconnectAniList();
    const data = await this.gql<{
      Viewer: { id: number; name: string; avatar?: { medium?: string } };
    }>(
      `query { Viewer { id name avatar { medium } } }`,
      {},
      clean,
    );
    if (!data?.Viewer) {
      throw new Error('Invalid AniList access token');
    }
    return this.saveConfig({
      anilistToken: clean,
      anilistUser: {
        id: data.Viewer.id,
        name: data.Viewer.name,
        avatar: data.Viewer.avatar?.medium,
      },
    });
  }

  disconnectAniList(): TrackerConfig {
    return this.saveConfig({});
  }

  async fetchMetadata(title: string, altTitle?: string | null): Promise<AniListMediaInfo | null> {
    const cacheKey = `${title.trim().toLowerCase()}|${(altTitle ?? '').trim().toLowerCase()}`;
    if (!title.trim()) return null;
    if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey) ?? null;

    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 5) {
          media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
            id
            format
            siteUrl
            title { english romaji }
            bannerImage
            coverImage { extraLarge large }
            averageScore
            popularity
            chapters
            status
            relations {
              edges {
                relationType
                node {
                  id
                  format
                  title { english romaji }
                  coverImage { large }
                }
              }
            }
            recommendations(perPage: 8, sort: RATING_DESC) {
              nodes {
                mediaRecommendation {
                  id
                  averageScore
                  title { english romaji }
                  coverImage { large }
                }
              }
            }
          }
        }
      }
    `;

    const candidates = buildTitleCandidates(title, altTitle);
    let matched: AniListRawMedia | null = null;
    let hadNetworkSuccess = false;

    for (const searchTerm of candidates) {
      const data = await this.gql<{
        Page?: { media?: AniListRawMedia[] };
      }>(query, { search: searchTerm });

      if (!data) continue;
      hadNetworkSuccess = true;

      const list = data.Page?.media ?? [];
      if (list.length === 0) continue;

      // Prefer non-novel manga/manhwa entries with recommendations and higher popularity
      const sorted = [...list].sort((a, b) => {
        const aIsNovel = a.format === 'NOVEL' ? 1 : 0;
        const bIsNovel = b.format === 'NOVEL' ? 1 : 0;
        if (aIsNovel !== bIsNovel) return aIsNovel - bIsNovel;
        const aRecs = (a.recommendations?.nodes ?? []).filter((n) => n.mediaRecommendation).length;
        const bRecs = (b.recommendations?.nodes ?? []).filter((n) => n.mediaRecommendation).length;
        if (aRecs !== bRecs) return bRecs - aRecs;
        return (b.popularity ?? 0) - (a.popularity ?? 0);
      });

      matched = sorted[0] ?? null;
      if (matched) break;
    }

    if (!matched) {
      if (hadNetworkSuccess) metadataCache.set(cacheKey, null);
      return null;
    }

    const result: AniListMediaInfo = {
      id: matched.id,
      title: matched.title?.english || matched.title?.romaji || title,
      bannerImage: matched.bannerImage,
      coverImage: matched.coverImage?.extraLarge || matched.coverImage?.large,
      averageScore: matched.averageScore,
      popularity: matched.popularity,
      chapters: matched.chapters,
      status: matched.status,
      siteUrl: matched.siteUrl,
      relations: (matched.relations?.edges ?? [])
        .filter((e) => e.node)
        .slice(0, 8)
        .map((e) => ({
          id: e.node!.id,
          title: e.node!.title?.english || e.node!.title?.romaji || 'Related',
          relationType: e.relationType.replace(/_/g, ' '),
          format: e.node!.format,
          cover: e.node!.coverImage?.large,
        })),
      recommendations: (matched.recommendations?.nodes ?? [])
        .filter((n) => n.mediaRecommendation)
        .map((n) => ({
          id: n.mediaRecommendation!.id,
          title:
            n.mediaRecommendation!.title?.english ||
            n.mediaRecommendation!.title?.romaji ||
            'Recommended',
          cover: n.mediaRecommendation!.coverImage?.large,
          score: n.mediaRecommendation!.averageScore,
        })),
    };

    metadataCache.set(cacheKey, result);
    return result;
  }

  async syncProgress(mangaTitle: string, chapterNumber: number): Promise<{ synced: boolean; progress?: number }> {
    const cfg = this.getConfig();
    if (!cfg.anilistToken || chapterNumber <= 0) return { synced: false };

    const meta = await this.fetchMetadata(mangaTitle);
    if (!meta) return { synced: false };

    const progress = Math.floor(chapterNumber);
    const mutation = `
      mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
        SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) {
          id
          progress
          status
        }
      }
    `;
    const status = meta.chapters && progress >= meta.chapters ? 'COMPLETED' : 'CURRENT';
    const data = await this.gql<{ SaveMediaListEntry?: { progress: number } }>(
      mutation,
      { mediaId: meta.id, progress, status },
      cfg.anilistToken,
    );
    return {
      synced: Boolean(data?.SaveMediaListEntry),
      progress: data?.SaveMediaListEntry?.progress,
    };
  }

  async getUserLists(): Promise<
    Array<{ id: number; title: string; progress: number; totalChapters?: number; cover?: string; status: string }>
  > {
    const cfg = this.getConfig();
    if (!cfg.anilistToken || !cfg.anilistUser) return [];
    const query = `
      query ($userId: Int) {
        MediaListCollection(userId: $userId, type: MANGA, status_in: [CURRENT, PLANNING]) {
          lists {
            name
            entries {
              progress
              status
              media {
                id
                chapters
                title { english romaji }
                coverImage { large }
              }
            }
          }
        }
      }
    `;
    const data = await this.gql<{
      MediaListCollection?: {
        lists?: Array<{
          entries?: Array<{
            progress: number;
            status: string;
            media?: {
              id: number;
              chapters?: number;
              title?: { english?: string; romaji?: string };
              coverImage?: { large?: string };
            };
          }>;
        }>;
      };
    }>(query, { userId: cfg.anilistUser.id }, cfg.anilistToken);

    const out: Array<{
      id: number;
      title: string;
      progress: number;
      totalChapters?: number;
      cover?: string;
      status: string;
    }> = [];
    for (const list of data?.MediaListCollection?.lists ?? []) {
      for (const e of list.entries ?? []) {
        if (!e.media) continue;
        out.push({
          id: e.media.id,
          title: e.media.title?.english || e.media.title?.romaji || 'Untitled',
          progress: e.progress,
          totalChapters: e.media.chapters,
          cover: e.media.coverImage?.large,
          status: e.status,
        });
      }
    }
    return out;
  }
}

export const trackerManager = new TrackerManager();
