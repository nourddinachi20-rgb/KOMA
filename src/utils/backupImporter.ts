import type {
  AppSettings,
  Category,
  HistoryEntry,
  LibraryEntry,
  Manga,
  MangaChapter,
  MangaState,
  MangaTag,
  ReadingStats,
  SourceInfo,
} from '../types';

export type BackupSourceFormat = 'koma' | 'kotatsu' | 'mihon';

export interface ParsedBackupResult {
  format: BackupSourceFormat;
  categories: Category[];
  library: LibraryEntry[];
  history: HistoryEntry[];
  settings?: Partial<AppSettings>;
  stats?: ReadingStats;
  unresolvedExternalCount: number;
}

const textDecoder = new TextDecoder('utf-8');

function toIsoDay(ts: number | undefined): string | null {
  if (!ts || !Number.isFinite(ts) || ts < 946684800000) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function decompressStream(bytes: Uint8Array, format: 'gzip' | 'deflate-raw'): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(`DecompressionStream(${format}) is not supported in this runtime`);
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream(format));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Extracts entries from any ZIP archive using the Central Directory (handles streaming ZipOutputStream
 * entries that use data descriptors where local header compressed size is 0).
 */
export async function readZipEntries(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minOffset = Math.max(0, bytes.byteLength - 65558);
  let eocdOffset = -1;
  for (let i = bytes.byteLength - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP / Kotatsu backup archive (EOCD header missing)');
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map<string, Uint8Array>();

  let pos = cdOffset;
  for (let i = 0; i < entryCount && pos + 46 <= bytes.byteLength; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);

    const rawName = textDecoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    const cleanName = rawName.toLowerCase().replace(/^\/+/, '').replace(/\.json$/, '');
    pos += 46 + nameLen + extraLen + commentLen;

    if (rawName.endsWith('/')) continue;
    if (localHeaderOffset + 30 > bytes.byteLength) continue;
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) continue;

    const lfNameLen = view.getUint16(localHeaderOffset + 26, true);
    const lfExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + lfNameLen + lfExtraLen;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) {
      entries.set(cleanName, compressed);
    } else if (method === 8) {
      const inflated = await decompressStream(compressed, 'deflate-raw');
      entries.set(cleanName, inflated);
    }
  }

  return entries;
}

interface ProtoField {
  tag: number;
  wireType: number;
  varint?: bigint;
  bytes?: Uint8Array;
  fixed32?: DataView;
}

function readVarint(bytes: Uint8Array, start: number): { value: bigint; next: number } {
  let result = 0n;
  let shift = 0n;
  let pos = start;
  while (pos < bytes.length) {
    const byte = bytes[pos++];
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value: result, next: pos };
    }
    shift += 7n;
    if (shift > 70n) throw new Error('Malformed protobuf varint');
  }
  throw new Error('Unexpected EOF while reading protobuf varint');
}

function decodeProtoFields(bytes: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    const key = readVarint(bytes, pos);
    pos = key.next;
    const tag = Number(key.value >> 3n);
    const wireType = Number(key.value & 0x7n);

    if (wireType === 0) {
      const v = readVarint(bytes, pos);
      pos = v.next;
      fields.push({ tag, wireType, varint: v.value });
    } else if (wireType === 1) {
      pos += 8;
      fields.push({ tag, wireType });
    } else if (wireType === 2) {
      const len = readVarint(bytes, pos);
      pos = len.next;
      const byteLen = Number(len.value);
      const slice = bytes.subarray(pos, pos + byteLen);
      pos += byteLen;
      fields.push({ tag, wireType, bytes: slice });
    } else if (wireType === 5) {
      const fixed32 = new DataView(bytes.buffer, bytes.byteOffset + pos, 4);
      pos += 4;
      fields.push({ tag, wireType, fixed32 });
    } else {
      throw new Error(`Unsupported protobuf wireType ${wireType} at byte ${pos}`);
    }
  }
  return fields;
}

function readPackedVarints(bytes: Uint8Array): bigint[] {
  const out: bigint[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    const v = readVarint(bytes, pos);
    out.push(v.value);
    pos = v.next;
  }
  return out;
}

function normalizeSourceToken(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const KNOWN_SOURCE_ALIASES: Record<string, string[]> = {
  mangadex: ['MANGADEX'],
  mangaball: ['MANGABALL_EN', 'MANGABALL'],
  asurascans: ['ASURASCANS', 'ASURATOON'],
  asuracomic: ['ASURASCANS'],
  weebcentral: ['WEEBCENTRAL'],
  mangapill: ['MANGAPILL'],
  mangaread: ['MANGAREAD'],
  lelmanga: ['LELMANGA'],
  teamx: ['TEAMXNOVEL', 'TEAMX'],
  teamxnovel: ['TEAMXNOVEL'],
  mangabat: ['MANGANATO', 'MANGAKAKALOT'],
  manganato: ['MANGANATO'],
  mangakakalot: ['MANGAKAKALOT'],
  bato: ['BATOTO'],
  batoto: ['BATOTO'],
  comick: ['COMICK_FUN', 'COMICK'],
  mangafire: ['MANGAFIRE_EN', 'MANGAFIRE'],
};

export function resolveKomaSource(
  rawSourceName: string,
  sources: SourceInfo[],
): { sourceName: string; exactOrMapped: boolean } {
  const exact = sources.find((s) => s.name === rawSourceName);
  if (exact) return { sourceName: exact.name, exactOrMapped: true };

  const norm = normalizeSourceToken(rawSourceName);
  if (!norm) {
    return { sourceName: `EXT_${norm || 'UNKNOWN'}`, exactOrMapped: false };
  }

  for (const [alias, candidates] of Object.entries(KNOWN_SOURCE_ALIASES)) {
    if (norm === alias || norm.startsWith(alias)) {
      for (const cand of candidates) {
        const hit = sources.find((s) => s.name === cand);
        if (hit) return { sourceName: hit.name, exactOrMapped: true };
      }
    }
  }

  const fuzzy = sources.find((s) => {
    const sName = normalizeSourceToken(s.name);
    const sTitle = normalizeSourceToken(s.title);
    return (
      sName === norm ||
      sTitle === norm ||
      sName.startsWith(norm) ||
      norm.startsWith(sTitle)
    );
  });

  if (fuzzy) {
    return { sourceName: fuzzy.name, exactOrMapped: true };
  }

  return { sourceName: rawSourceName.toUpperCase().replace(/\s+/g, '_') || 'IMPORTED', exactOrMapped: false };
}

function mapKotatsuState(raw?: string | null): MangaState | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === 'ONGOING' || upper === 'FINISHED' || upper === 'ABANDONED' || upper === 'PAUSED' || upper === 'UPCOMING' || upper === 'RESTRICTED') {
    return upper as MangaState;
  }
  return null;
}

function mapTachiyomiStatus(status: number): MangaState | null {
  switch (status) {
    case 1:
      return 'ONGOING';
    case 2:
    case 4:
      return 'FINISHED';
    case 5:
      return 'ABANDONED';
    case 6:
      return 'PAUSED';
    default:
      return null;
  }
}

interface KotatsuCategoryJson {
  category_id: number;
  sort_key?: number;
  title: string;
}

interface KotatsuTagJson {
  title: string;
  key: string;
  source?: string;
}

interface KotatsuMangaJson {
  id: number | string;
  title: string;
  alt_title?: string | null;
  url: string;
  public_url?: string;
  rating?: number;
  content_rating?: string | null;
  cover_url?: string | null;
  large_cover_url?: string | null;
  state?: string | null;
  author?: string | null;
  source: string;
  tags?: KotatsuTagJson[];
}

interface KotatsuFavouriteJson {
  manga_id: number | string;
  category_id: number | string;
  created_at?: number;
  manga: KotatsuMangaJson;
}

interface KotatsuHistoryJson {
  manga_id: number | string;
  updated_at?: number;
  created_at?: number;
  chapter_id?: number | string;
  page?: number;
  percent?: number;
  chapters?: number;
  manga: KotatsuMangaJson;
}

function kotatsuMangaToKoma(m: KotatsuMangaJson, sources: SourceInfo[]): Manga {
  const { sourceName } = resolveKomaSource(m.source || '', sources);
  const tags: MangaTag[] = (m.tags ?? []).map((t) => ({
    title: t.title,
    key: t.key,
    source: t.source || sourceName,
  }));
  return {
    id: String(m.id),
    title: m.title,
    altTitles: m.alt_title ? [m.alt_title] : [],
    url: m.url,
    publicUrl: m.public_url ?? '',
    rating: typeof m.rating === 'number' ? m.rating : -1,
    contentRating: m.content_rating ?? null,
    coverUrl: m.cover_url ?? null,
    largeCoverUrl: m.large_cover_url ?? m.cover_url ?? null,
    state: mapKotatsuState(m.state),
    authors: m.author ? [m.author] : [],
    description: null,
    source: sourceName,
    tags,
    chapters: null,
  };
}

function parseJsonPreservingLongIds(bytes: Uint8Array): unknown {
  const txt = textDecoder.decode(bytes);
  // Quote 16+ digit integer IDs (Kotatsu 64-bit hashes) so JS Number precision isn't lost
  const safe = txt.replace(/("(?:id|manga_id|chapter_id|category_id)"\s*:\s*)(-?\d{16,})/g, '$1"$2"');
  return JSON.parse(safe);
}

function parseKotatsuZip(entries: Map<string, Uint8Array>, sources: SourceInfo[]): ParsedBackupResult {
  const rawCats = entries.get('categories');
  const rawFavs = entries.get('favourites');
  const rawHist = entries.get('history');

  if (!rawFavs && !rawHist && !rawCats) {
    throw new Error('ZIP does not look like a Kotatsu backup (missing categories/favourites/history)');
  }

  const catList: KotatsuCategoryJson[] = rawCats
    ? (parseJsonPreservingLongIds(rawCats) as KotatsuCategoryJson[])
    : [];
  const favList: KotatsuFavouriteJson[] = rawFavs
    ? (parseJsonPreservingLongIds(rawFavs) as KotatsuFavouriteJson[])
    : [];
  const histList: KotatsuHistoryJson[] = rawHist
    ? (parseJsonPreservingLongIds(rawHist) as KotatsuHistoryJson[])
    : [];

  const categories: Category[] = catList
    .slice()
    .sort((a, b) => (a.sort_key ?? 0) - (b.sort_key ?? 0))
    .map((c, idx) => ({
      id: `kotatsu-${c.category_id}`,
      name: c.title || `Category ${idx + 1}`,
      order: c.sort_key ?? idx,
    }));

  const histByManga = new Map<string, KotatsuHistoryJson>();
  const history: HistoryEntry[] = [];
  const activeDaySet = new Set<string>();
  for (const h of histList) {
    if (!h.manga) continue;
    const manga = kotatsuMangaToKoma(h.manga, sources);
    const key = `${manga.source}::${manga.id}`;
    histByManga.set(key, h);
    const d1 = toIsoDay(h.updated_at);
    const d2 = toIsoDay(h.created_at);
    if (d1) activeDaySet.add(d1);
    if (d2) activeDaySet.add(d2);
    const totalCh = typeof h.chapters === 'number' && h.chapters > 0 ? h.chapters : 0;
    const pct = typeof h.percent === 'number' && h.percent > 0 ? Math.min(1, h.percent) : 0;
    const approxCh = totalCh > 0 && pct > 0 ? Math.max(1, Math.min(totalCh, Math.round(pct * totalCh))) : 0;
    history.push({
      key,
      manga,
      chapterId: String(h.chapter_id ?? '0'),
      chapterNumber: approxCh,
      chapterTitle: approxCh > 0 ? `~Ch. ${approxCh}` : 'Last Read',
      pageIndex: Math.max(0, h.page ?? 0),
      totalPages: 0,
      updatedAt: h.updated_at || h.created_at || Date.now(),
    });
  }

  const libMap = new Map<string, LibraryEntry>();
  for (const f of favList) {
    if (!f.manga) continue;
    const manga = kotatsuMangaToKoma(f.manga, sources);
    const key = `${manga.source}::${manga.id}`;
    const catId = `kotatsu-${f.category_id}`;
    const existing = libMap.get(key);
    if (existing) {
      if (!existing.categoryIds.includes(catId)) {
        existing.categoryIds.push(catId);
      }
      continue;
    }

    const hist = histByManga.get(key);
    libMap.set(key, {
      key,
      manga,
      categoryIds: [catId],
      addedAt: f.created_at || Date.now(),
      lastReadAt: hist?.updated_at,
      totalChapters: hist?.chapters ?? 0,
    });
  }

  return {
    format: 'kotatsu',
    categories: categories.length > 0 ? categories : [{ id: 'reading', name: 'Reading', order: 0 }],
    library: Array.from(libMap.values()),
    history,
    stats: {
      chaptersCompleted: 0,
      pagesRead: 0,
      readingMinutes: 0,
      activeDays: Array.from(activeDaySet).sort(),
      genreCounts: {},
    },
    unresolvedExternalCount: 0,
  };
}

function parseMihonProtobuf(rawProto: Uint8Array, sources: SourceInfo[]): ParsedBackupResult {
  const rootFields = decodeProtoFields(rawProto);
  const rawMangaMsgs: Uint8Array[] = [];
  const rawCategoryMsgs: Uint8Array[] = [];
  const sourceNameById = new Map<string, string>();

  for (const f of rootFields) {
    if (f.tag === 1 && f.bytes) rawMangaMsgs.push(f.bytes);
    else if (f.tag === 2 && f.bytes) rawCategoryMsgs.push(f.bytes);
    else if (f.tag === 101 && f.bytes) {
      let sName = '';
      let sId = 0n;
      for (const sf of decodeProtoFields(f.bytes)) {
        if (sf.tag === 1 && sf.bytes) sName = textDecoder.decode(sf.bytes);
        if (sf.tag === 2 && sf.varint !== undefined) sId = BigInt.asIntN(64, sf.varint);
      }
      if (sName) sourceNameById.set(sId.toString(), sName);
    }
  }

  if (rawMangaMsgs.length === 0 && rawCategoryMsgs.length === 0) {
    throw new Error('No Mihon / Komikku manga or categories found in protobuf stream');
  }

  const categories: Category[] = [];
  const catIdToKoma = new Map<string, string>();

  rawCategoryMsgs.forEach((catBytes, idx) => {
    let name = `Category ${idx + 1}`;
    let order = idx;
    let rawId = BigInt(idx);
    let hasId = false;
    for (const cf of decodeProtoFields(catBytes)) {
      if (cf.tag === 1 && cf.bytes) name = textDecoder.decode(cf.bytes);
      else if (cf.tag === 2 && cf.varint !== undefined) order = Number(cf.varint);
      else if (cf.tag === 3 && cf.varint !== undefined) {
        rawId = BigInt.asIntN(64, cf.varint);
        hasId = true;
      }
    }
    const komaCatId = `mihon-${rawId.toString()}`;
    categories.push({ id: komaCatId, name, order });
    catIdToKoma.set(rawId.toString(), komaCatId);
    if (!hasId) {
      catIdToKoma.set(String(order), komaCatId);
    }
    catIdToKoma.set(`idx-${idx}`, komaCatId);
  });

  const library: LibraryEntry[] = [];
  const history: HistoryEntry[] = [];
  const activeDaySet = new Set<string>();
  let unresolvedExternalCount = 0;

  for (const mBytes of rawMangaMsgs) {
    let sourceId = 0n;
    let url = '';
    let title = '';
    let customTitle = '';
    let artist = '';
    let author = '';
    let customAuthor = '';
    let description = '';
    let customDescription = '';
    let status = 0;
    let thumbnailUrl = '';
    let customThumbnailUrl = '';
    let dateAdded = Date.now();
    let favorite = true;
    const genres: string[] = [];
    const categoryRefs: bigint[] = [];
    const chapters: Array<{
      url: string;
      name: string;
      scanlator?: string;
      read: boolean;
      lastPageRead: number;
      dateUpload: number;
      chapterNumber: number;
    }> = [];
    const histItems: Array<{ url: string; lastRead: number }> = [];

    for (const mf of decodeProtoFields(mBytes)) {
      switch (mf.tag) {
        case 1:
          if (mf.varint !== undefined) sourceId = BigInt.asIntN(64, mf.varint);
          break;
        case 2:
          if (mf.bytes) url = textDecoder.decode(mf.bytes);
          break;
        case 3:
          if (mf.bytes) title = textDecoder.decode(mf.bytes);
          break;
        case 4:
          if (mf.bytes) artist = textDecoder.decode(mf.bytes);
          break;
        case 5:
          if (mf.bytes) author = textDecoder.decode(mf.bytes);
          break;
        case 6:
          if (mf.bytes) description = textDecoder.decode(mf.bytes);
          break;
        case 7:
          if (mf.bytes) genres.push(textDecoder.decode(mf.bytes));
          break;
        case 8:
          if (mf.varint !== undefined) status = Number(mf.varint);
          break;
        case 9:
          if (mf.bytes) thumbnailUrl = textDecoder.decode(mf.bytes);
          break;
        case 13:
          if (mf.varint !== undefined) dateAdded = Number(mf.varint) || Date.now();
          break;
        case 16:
          if (mf.bytes) {
            const ch = {
              url: '',
              name: '',
              scanlator: undefined as string | undefined,
              read: false,
              lastPageRead: 0,
              dateUpload: 0,
              chapterNumber: 0,
            };
            for (const chf of decodeProtoFields(mf.bytes)) {
              if (chf.tag === 1 && chf.bytes) ch.url = textDecoder.decode(chf.bytes);
              else if (chf.tag === 2 && chf.bytes) ch.name = textDecoder.decode(chf.bytes);
              else if (chf.tag === 3 && chf.bytes) ch.scanlator = textDecoder.decode(chf.bytes);
              else if (chf.tag === 4 && chf.varint !== undefined) ch.read = chf.varint !== 0n;
              else if (chf.tag === 6 && chf.varint !== undefined) ch.lastPageRead = Number(chf.varint);
              else if (chf.tag === 8 && chf.varint !== undefined) ch.dateUpload = Number(chf.varint);
              else if (chf.tag === 9 && chf.fixed32) ch.chapterNumber = chf.fixed32.getFloat32(0, true);
            }
            chapters.push(ch);
          }
          break;
        case 17:
          if (mf.varint !== undefined) categoryRefs.push(BigInt.asIntN(64, mf.varint));
          else if (mf.bytes) {
            for (const c of readPackedVarints(mf.bytes)) {
              categoryRefs.push(BigInt.asIntN(64, c));
            }
          }
          break;
        case 100:
          if (mf.varint !== undefined) favorite = mf.varint !== 0n;
          break;
        case 104:
          if (mf.bytes) {
            let hUrl = '';
            let hLastRead = 0;
            for (const hf of decodeProtoFields(mf.bytes)) {
              if (hf.tag === 1 && hf.bytes) hUrl = textDecoder.decode(hf.bytes);
              else if (hf.tag === 2 && hf.varint !== undefined) hLastRead = Number(hf.varint);
            }
            if (hUrl) histItems.push({ url: hUrl, lastRead: hLastRead });
          }
          break;
        case 603:
          if (mf.bytes) customThumbnailUrl = textDecoder.decode(mf.bytes);
          break;
        case 800:
          if (mf.bytes) customTitle = textDecoder.decode(mf.bytes);
          break;
        case 802:
          if (mf.bytes) customAuthor = textDecoder.decode(mf.bytes);
          break;
        case 804:
          if (mf.bytes) customDescription = textDecoder.decode(mf.bytes);
          break;
      }
    }

    const finalTitle = (customTitle || title || 'Untitled').trim();
    const rawSourceName = sourceNameById.get(sourceId.toString()) || `SOURCE_${sourceId.toString()}`;
    const { sourceName, exactOrMapped } = resolveKomaSource(rawSourceName, sources);
    if (!exactOrMapped) unresolvedExternalCount++;

    const mangaId = `mihon-${sourceId.toString()}-${encodeURIComponent(url || finalTitle).slice(0, 48)}`;
    const komaChapters: MangaChapter[] = chapters.map((ch, idx) => ({
      id: ch.url || `${mangaId}::ch-${idx}`,
      title: ch.name || null,
      number: ch.chapterNumber,
      volume: 0,
      url: ch.url,
      scanlator: ch.scanlator ?? null,
      uploadDate: ch.dateUpload,
      branch: null,
      source: sourceName,
    }));

    const authorsList = Array.from(
      new Set([customAuthor || author, artist].map((x) => x.trim()).filter(Boolean)),
    );

    const manga: Manga = {
      id: mangaId,
      title: finalTitle,
      altTitles: customTitle && title && customTitle !== title ? [title] : [],
      url: url || finalTitle,
      publicUrl: url.startsWith('http') ? url : '',
      rating: -1,
      contentRating: null,
      coverUrl: customThumbnailUrl || thumbnailUrl || null,
      largeCoverUrl: customThumbnailUrl || thumbnailUrl || null,
      state: mapTachiyomiStatus(status),
      authors: authorsList,
      description: customDescription || description || null,
      source: sourceName,
      tags: genres.map((g) => ({
        title: g,
        key: g.toLowerCase().replace(/\s+/g, '-'),
        source: sourceName,
      })),
      chapters: komaChapters.length > 0 ? komaChapters : null,
    };

    const key = `${sourceName}::${mangaId}`;
    const readIds = chapters.filter((c) => c.read).map((c, idx) => c.url || `${mangaId}::ch-${idx}`);

    for (const hi of histItems) {
      const day = toIsoDay(hi.lastRead);
      if (day) activeDaySet.add(day);
    }

    const latestHist = histItems.sort((a, b) => b.lastRead - a.lastRead)[0];
    const matchedHistChapter = latestHist
      ? chapters.find((c) => c.url === latestHist.url)
      : chapters.find((c) => !c.read && c.lastPageRead > 0);
    const fallbackReadChapter =
      !latestHist && !matchedHistChapter && !favorite && readIds.length > 0
        ? chapters.filter((c) => c.read).slice(-1)[0]
        : undefined;

    if (latestHist || matchedHistChapter || fallbackReadChapter) {
      const chMatch = matchedHistChapter ?? fallbackReadChapter;
      history.push({
        key,
        manga,
        chapterId: chMatch?.url || latestHist?.url || '',
        chapterNumber: chMatch?.chapterNumber ?? 0,
        chapterTitle: chMatch?.name || 'Last Read',
        pageIndex: Math.max(0, chMatch?.lastPageRead ?? 0),
        totalPages: 0,
        updatedAt: latestHist?.lastRead || chMatch?.dateUpload || Date.now(),
        ...(readIds.length > 0 && !favorite ? { importedChaptersRead: readIds.length } : {}),
      });
    }

    if (favorite) {
      const resolvedCats = Array.from(
        new Set(
          categoryRefs
            .map(
              (cid) =>
                catIdToKoma.get(cid.toString()) ??
                catIdToKoma.get(`idx-${cid.toString()}`),
            )
            .filter((x): x is string => Boolean(x)),
        ),
      );
      if (resolvedCats.length === 0) {
        resolvedCats.push(categories[0]?.id ?? 'reading');
      }

      library.push({
        key,
        manga,
        categoryIds: resolvedCats,
        addedAt: dateAdded,
        lastReadAt: latestHist?.lastRead,
        totalChapters: komaChapters.length,
        readChapterIds: readIds,
        unreadCount: Math.max(0, komaChapters.length - readIds.length),
      });
    }
  }

  return {
    format: 'mihon',
    categories: categories.length > 0 ? categories : [{ id: 'reading', name: 'Reading', order: 0 }],
    library,
    history,
    stats: {
      chaptersCompleted: 0,
      pagesRead: 0,
      readingMinutes: 0,
      activeDays: Array.from(activeDaySet).sort(),
      genreCounts: {},
    },
    unresolvedExternalCount,
  };
}

export async function parseAnyBackupBytes(
  bytes: Uint8Array,
  fileName: string,
  sources: SourceInfo[],
): Promise<ParsedBackupResult> {
  if (bytes.length === 0) {
    throw new Error('Selected backup file is empty');
  }

  // 1. Gzip-compressed Protobuf (.tachibk / .proto.gz from Mihon & Komikku)
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const rawProto = await gunzipBytes(bytes);
    return parseMihonProtobuf(rawProto, sources);
  }

  // 2. ZIP archive (.bk / .bk.zip / .zip from Kotatsu)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const entries = await readZipEntries(bytes);
    return parseKotatsuZip(entries, sources);
  }

  // 3. KOMA / raw JSON
  const lower = fileName.toLowerCase();
  const txt = textDecoder.decode(bytes).trim();
  if (txt.startsWith('{') || lower.endsWith('.json')) {
    const raw = JSON.parse(txt) as Record<string, unknown>;
    return {
      format: 'koma',
      categories: Array.isArray(raw.categories) ? (raw.categories as Category[]) : [],
      library: Array.isArray(raw.library) ? (raw.library as LibraryEntry[]) : [],
      history: Array.isArray(raw.history) ? (raw.history as HistoryEntry[]) : [],
      settings:
        raw.settings && typeof raw.settings === 'object'
          ? (raw.settings as Partial<AppSettings>)
          : undefined,
      stats:
        raw.stats && typeof raw.stats === 'object' ? (raw.stats as ReadingStats) : undefined,
      unresolvedExternalCount: 0,
    };
  }

  // 4. Fallback: try uncompressed protobuf (.proto)
  try {
    return parseMihonProtobuf(bytes, sources);
  } catch {
    throw new Error(
      `Unsupported backup file "${fileName}". Supported: KOMA (.json), Kotatsu (.bk / .bk.zip), Mihon & Komikku (.tachibk / .proto.gz).`,
    );
  }
}

async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  return decompressStream(bytes, 'gzip');
}
