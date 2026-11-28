import QRCode from 'qrcode';

const REPO = 'nourddinachi20-rgb/KOMA';
const DEFAULT_VERSION = '1.1.6';
const DEFAULT_APK_URL = `https://github.com/${REPO}/releases/download/v${DEFAULT_VERSION}/KOMA-Android.apk`;

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name?: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string;
  assets?: GitHubReleaseAsset[];
}

const FALLBACK_RELEASES: GitHubRelease[] = [
  {
    tag_name: 'v1.1.6',
    name: 'KOMA v1.1.6',
    published_at: '2026-11-28T19:50:00Z',
    body: `### Improvements
- **Centered Header & 5-Button Bottom Navigation:** Larger centered KOMA header on top and \`[Home | Library | Search | Explore | Settings]\` bottom navbar with a distinct central Search button.
- **Consolidated Library & Settings:** Moved **Updates** and **Offline** into **Library** tabs, merged **Sources** into **Settings**, removed the Custom accent picker, and added \`made by : VirtualDrum\` under the version footer.`,
  },
  {
    tag_name: 'v1.1.5',
    name: 'KOMA v1.1.5',
    published_at: '2026-11-28T19:30:00Z',
    body: `### Fixes
- **Instant Sources & No Broken-Source Ghost Banner:** Ships all 95 verified sources in Android assets alongside Desktop, merges bundled sources on every launch/update, and clears transient failed keys across restarts.
- **Home Covers & Full Hero Synopses:** Staggers initial cover loading with resilient image retries on Hero banners & cards, and adds MangaDex API + alt-title AniList fallbacks so Hero items show synopses reliably.
- **UI Debloat:** Strips promo badges ("Spotlight", "End-to-End Encrypted", "Made by VirtualDrum"), extra logos, and filler text.`,
  },
  {
    tag_name: 'v1.1.4',
    name: 'KOMA v1.1.4',
    published_at: '2026-11-28T03:45:00Z',
    body: `### Improvements
- **Instant Lag-Free Bundled Intro:** Ships 12 pre-sized lightweight manga covers locally inside the app and eliminates mid-boot store re-renders and remote cover decoding during the splash screen so startup is smooth from frame 0.
- **Removed AsuraScans Extension:** Dropped AsuraScans from bundled sources, defaults, and pre-warming, and marks existing AsuraScans library entries as migratable.`,
  },
  {
    tag_name: 'v1.1.3',
    name: 'KOMA v1.1.3',
    published_at: '2026-11-28T03:30:00Z',
    body: `### Fixes
- **Cross-App Reading Statistics:** Counts series, finished chapters, pages, reading days, and favorite genres from Kotatsu, Mihon, and Komikku backups alongside KOMA reading, and syncs stats across devices.
- **Hero Spotlight Layout & Complete Descriptions:** Prefetches details + AniList synopsis/genres for every Hero slide so descriptions and genres always appear consistently, with genres placed right under the author name and Read Now, Details & Chapters, and Bookmark aligned cleanly below.`,
  },
  {
    tag_name: 'v1.1.2',
    name: 'KOMA v1.1.2',
    published_at: '2026-11-28T02:05:00Z',
    body: `### Fixes
- **Sync Payload Compaction & Worker Guards:** Compacts encrypted sync vaults (~12x smaller by omitting cached chapter lists) and prevents Cloudflare 500 / mobile Failed to fetch errors.
- **Zero False Broken Mihon/Komikku Flags & Faster Updates:** Stops flagging working Mihon/Komikku entries as broken, recognizes \`COMICK_FUN\`/\`MANHUARM\`/\`MANGA_DEMON\` as dead, and skips dead/unverified entries quickly in Update Library.
- **Migration Duplicate Merge & Kotatsu Progress:** Merges cross-source duplicate titles during migration and computes \`~Ch. X\` from Kotatsu backup history.
- **Light Paper, Arabic RTL & Tablet Polish:** Fixed Light Paper Explore/Spotlight/Reader/Splash contrast, RTL title truncation, 768px tablet navbar layout, empty Sign In hints, and Download Modal labels.`,
  },
  {
    tag_name: 'v1.1.1',
    name: 'KOMA v1.1.1',
    published_at: '2026-11-28T01:08:00Z',
    body: `### Fixes
- **Catch Dead Sources (MangaPark, MangaSee, Comick, etc.):** Removed dead domains from verified defaults and wired \`checkLibraryUpdates\` + \`prefetchMangaDetails\` to flag 0-chapter or failing entries persistently rather than reporting "Library is up to date".
- **Manga Page Top Bar Spacing:** Added extra top safe-area padding on MangaDetailsPage so Back and Open Web never clip behind phone status bars.`,
  },
  {
    tag_name: 'v1.1.0',
    name: 'KOMA v1.1.0',
    published_at: '2026-11-28T00:50:00Z',
    body: `### New Features
- **Smart Chapter Deduplication:** Automatically hides duplicate uploads of the same chapter across the chapter list, Reader next/previous navigation, Quick Play, and downloads, keeping only the latest version.
- **Collapse .x Sub-Chapters:** Added an optional global setting in Settings plus a one-tap per-series toggle whenever \`.1\`/\`.2\`/\`.6\` chapters exist.`,
  },
  {
    tag_name: 'v1.0.9',
    name: 'KOMA v1.0.9',
    published_at: '2026-11-28T00:35:00Z',
    body: `### Fixes
- **Library Update Check No Longer Reverts Migrations:** Rewrote \`checkLibraryUpdates\` on both Android and Windows to check 6 titles concurrently with a 15s timeout and re-read current \`library.json\` under lock before saving — stopping stale background chapter checks from overwriting migrated manga back to old broken sources.
- **Website Cache-Busting:** Appends content build tags to bundled website assets so release history renders immediately without stale browser cache.`,
  },
  {
    tag_name: 'v1.0.8',
    name: 'KOMA v1.0.8',
    published_at: '2026-11-28T00:24:17Z',
    body: `### Fixes
- **No More Resurrected Broken Mangas After Restart:** Added \`deletedLibraryKeys\` tombstones to local storage & encrypted cloud sync, plus immediate silent upload after migration.
- **Zero Race Conditions During Large Migrations:** Serialized batch commits sequentially, snapshotted the modal session list on open, and flushed pending items safely on Close / Stop.
- **Cover Preservation & Better Matching:** Kept existing manga covers if a destination source returns blank covers, expanded fallback search up to 14 working sources, and added word-overlap matching.`,
  },
  {
    tag_name: 'v1.0.7',
    name: 'KOMA v1.0.7',
    published_at: '2026-11-28T00:15:36Z',
    body: `### Improvements
- **Full-Page Welcome Screen:** Minimal black full-screen Sign In / Create Account / Continue as Guest page with zero modal clutter.
- **Smooth Geometric Logo Animation:** Animated KOMA emblem lines, diagonal slash blades, and center accent spark on startup.
- **Background Engine Warmup:** Source engine and home feeds now boot silently behind the welcome screen.`,
  },
  {
    tag_name: 'v1.0.6',
    name: 'KOMA v1.0.6',
    published_at: '2026-11-28T00:02:32Z',
    body: `### New Features
- **Welcome Account Screen:** Choose Sign In, Create Account, or Continue as Guest on first launch.
- **Unified In-App Dropdowns:** Replaced Android system select popups with centered KOMA menus.

### Fixes
- **Crash-Proof Batch Migration:** Added storage mutex locks, atomic file writes, working-source filtering, and auto-fallback across sources.
- **Reliable Cold-Start Covers:** Upgraded backend image proxy fallbacks and automatic frontend retries.
- **Quality of Life:** Opening Search, switching views, or tapping outside automatically closes open dropdowns.`,
  },
  {
    tag_name: 'v1.0.5',
    name: 'KOMA v1.0.5',
    published_at: '2026-11-27T23:38:17Z',
    body: `### New Features
- **Instant Cross-Device Account Sync:** Sign up or sign in from any phone, tablet, or Windows PC using only a Username and Password via the hosted Cloudflare Worker backend.
- **Persistent Login & Auto-Sync:** Stay signed in across launches with automatic remote pull on startup and silent background sync.`,
  },
  {
    tag_name: 'v1.0.4',
    name: 'KOMA v1.0.4',
    published_at: '2026-11-27T23:09:42Z',
    body: `### New Features
- **Zero-Knowledge Account Sync:** Client-side AES-256-GCM encrypted account sync with no Google sign-in or email required.
- **Open-Source Sync Worker:** Included self-hostable Cloudflare Worker in \`sync-worker/\`.

### Improvements
- **Faster Bulk Migration:** Parallel search queue with primary-source early exit.`,
  },
  {
    tag_name: 'v1.0.3',
    name: 'KOMA v1.0.3',
    published_at: '2026-11-27T22:57:58Z',
    body: `### New Features
- **Broken-Source Detector & Bulk Migration:** Automatically flags library manga from broken or missing sources with one-click Bulk Migration.

### Improvements
- **Headerless Manga Pages:** Hides the global app header on manga detail pages.`,
  },
  {
    tag_name: 'v1.0.2',
    name: 'KOMA v1.0.2',
    published_at: '2026-11-27T22:48:05Z',
    body: `### New Features
- **Flexible Download Picker:** Download unread chapters, all chapters, custom ranges, or selected chapters.
- **Swipe Page Turns:** Swipe left/right to turn pages on phones and tablets.

### Improvements
- **Clean Mobile Layout:** Compact Library upfront, 3rd card peek in carousels, aligned action buttons, organized Settings sections, single unified font, and auto Webtoon/Manga format detection.`,
  },
  {
    tag_name: 'v1.0.1',
    name: 'KOMA v1.0.1',
    published_at: '2026-11-27T22:22:16Z',
    body: `### New Features
- **Theme & Color Customization:** Switch between Pure Black (#000000), Dark Slate, and Light Paper plus custom accent colors.
- **Interface Languages:** Added English, French, and Arabic UI support (with RTL support).

### Improvements
- **Pure Black & White UI:** Monochrome black-and-white visual overhaul across Desktop & Android.`,
  },
  {
    tag_name: 'v1.0.0',
    name: 'KOMA v1.0.0',
    published_at: '2026-11-27T21:41:08Z',
    body: `### New Features
- **Initial Windows & Android Release:** Embedded Kotlin Kotatsu/MangaBall engine, adaptive desktop/tablet/phone UI, Chromium Cloudflare solver, AniList sync, CBZ offline sanctuary, Komikku/Mihon/Kotatsu backup import, and in-app updater.`,
  },
];

const SHOWCASE_SCREENS: Record<
  string,
  { src: string; caption: string; tag: string }
> = {
  home: {
    src: './screenshots/desktop-home.png',
    caption: 'Home spotlight and trending feeds',
    tag: 'HOME',
  },
  details: {
    src: './screenshots/desktop-details.png',
    caption: 'Chapters list, AniList info and related titles',
    tag: 'DETAILS',
  },
  reader: {
    src: './screenshots/desktop-reader.png',
    caption: 'Reader view with chapter drawer, zoom and auto-scroll',
    tag: 'READER',
  },
  explore: {
    src: './screenshots/tablet-explore.png',
    caption: 'Browse EN, FR and AR manga sources',
    tag: 'EXPLORE',
  },
};

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function normalizeVer(raw?: string): string {
  return (raw || '').replace(/^v/i, '').trim();
}

function compareSemver(aRaw: string, bRaw: string): number {
  const aParts = normalizeVer(aRaw).split('.').map((p) => Number.parseInt(p.replace(/[^0-9].*$/, ''), 10) || 0);
  const bParts = normalizeVer(bRaw).split('.').map((p) => Number.parseInt(p.replace(/[^0-9].*$/, ''), 10) || 0);
  const len = Math.max(aParts.length, bParts.length, 3);
  for (let i = 0; i < len; i++) {
    const a = aParts[i] ?? 0;
    const b = bParts[i] ?? 0;
    if (a !== b) return a > b ? 1 : -1;
  }
  return 0;
}

async function renderQr(url: string, versionLabel?: string): Promise<void> {
  const container = document.getElementById('apk-qr');
  if (!container) return;
  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: 96,
      margin: 1,
      color: { dark: '#FFFFFF', light: '#0A0A0D' },
    });
    container.innerHTML = svg;
    const caption = document.getElementById('apk-qr-caption');
    if (caption && versionLabel) {
      caption.textContent = `QR · v${versionLabel}`;
    }
  } catch {
    container.textContent = 'QR';
  }
}

function detectPlatform(): 'android' | 'windows' | 'other' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('windows')) return 'windows';
  return 'other';
}

function initShowcaseTabs(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-screen-tab]'));
  const img = document.getElementById('showcase-main-img') as HTMLImageElement | null;
  const caption = document.getElementById('showcase-caption');
  const tag = document.getElementById('showcase-tag');
  if (!img || buttons.length === 0) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.screenTab || 'home';
      const data = SHOWCASE_SCREENS[key];
      if (!data) return;

      buttons.forEach((b) => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');

      img.src = data.src;
      if (caption) caption.textContent = data.caption;
      if (tag) tag.textContent = data.tag;
    });
  });
}

function parseMarkdownSections(markdown: string): Array<{ title: string; items: string[] }> {
  const sections: Array<{ title: string; items: string[] }> = [];
  let cur: { title: string; items: string[] } | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line === '# Changelog') continue;
    const h = line.match(/^#{1,4}\s+(.+)$/);
    if (h) {
      const heading = h[1].trim();
      if (/^v?\d+\.\d+\.\d+/i.test(heading)) continue;
      cur = { title: heading, items: [] };
      sections.push(cur);
      continue;
    }
    const b = line.match(/^[-*•]\s+(.+)$/);
    if (b) {
      if (!cur) {
        cur = { title: 'Changes', items: [] };
        sections.push(cur);
      }
      cur.items.push(b[1].replace(/\*\*/g, '').replace(/`/g, '').trim());
    }
  }
  return sections;
}

function renderReleaseHistory(releases: GitHubRelease[]): void {
  const listEl = document.getElementById('release-history-list');
  const toggleAllBtn = document.getElementById('btn-toggle-history');
  const heading = document.getElementById('whats-new-title');
  if (!listEl || releases.length === 0) return;

  const topVer = (releases[0].tag_name || releases[0].name || DEFAULT_VERSION).replace(/^v/i, '').trim();
  if (heading) heading.textContent = `Changelog · v${topVer}`;

  listEl.innerHTML = releases
    .map((rel, idx) => {
      const ver = (rel.tag_name || rel.name || '').replace(/^v/i, '').trim();
      const isLatest = idx === 0;
      const expanded = idx < 2;
      const dateStr = formatDate(rel.published_at);
      const sections = parseMarkdownSections(rel.body || '');

      const bodyHtml =
        sections.length > 0
          ? `<div class="notes-grid">${sections
              .map(
                (sec) => `
              <div class="card-surface">
                <div class="mono notes-title">${escapeHtml(sec.title)}</div>
                <ul class="notes-list">
                  ${sec.items
                    .map(
                      (item) => `
                    <li>
                      <span class="dot-white"></span>
                      <span>${escapeHtml(item)}</span>
                    </li>`,
                    )
                    .join('')}
                </ul>
              </div>`,
              )
              .join('')}</div>`
          : `<p style="margin:0;font-size:13px;color:#a1a1aa;">Release v${escapeHtml(ver)}</p>`;

      return `
      <article class="release-entry" data-latest="${isLatest ? 'true' : 'false'}">
        <button type="button" class="release-head" aria-expanded="${expanded ? 'true' : 'false'}" data-release-toggle="${idx}">
          <div class="release-head-left">
            <span class="mono release-tag">v${escapeHtml(ver)}</span>
            ${isLatest ? '<span class="mono badge-latest">Latest</span>' : ''}
            ${dateStr ? `<span class="mono release-date">${escapeHtml(dateStr)}</span>` : ''}
          </div>
          <span class="mono release-date" data-release-chevron>${expanded ? 'Hide' : 'Show'}</span>
        </button>
        <div class="release-body" ${expanded ? '' : 'hidden'}>
          ${bodyHtml}
        </div>
      </article>`;
    })
    .join('');

  const heads = Array.from(listEl.querySelectorAll<HTMLButtonElement>('[data-release-toggle]'));
  heads.forEach((btn) => {
    btn.addEventListener('click', () => {
      const body = btn.nextElementSibling as HTMLElement | null;
      const chev = btn.querySelector('[data-release-chevron]');
      if (!body) return;
      const nextOpen = body.hasAttribute('hidden');
      if (nextOpen) body.removeAttribute('hidden');
      else body.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      if (chev) chev.textContent = nextOpen ? 'Hide' : 'Show';
    });
  });

  if (toggleAllBtn) {
    let allOpen = false;
    toggleAllBtn.textContent = 'Expand all';
    toggleAllBtn.onclick = () => {
      allOpen = !allOpen;
      heads.forEach((btn) => {
        const body = btn.nextElementSibling as HTMLElement | null;
        const chev = btn.querySelector('[data-release-chevron]');
        if (!body) return;
        if (allOpen) body.removeAttribute('hidden');
        else body.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
        if (chev) chev.textContent = allOpen ? 'Hide' : 'Show';
      });
      toggleAllBtn.textContent = allOpen ? 'Collapse all' : 'Expand all';
    };
  }
}

async function init(): Promise<void> {
  initShowcaseTabs();
  renderReleaseHistory(FALLBACK_RELEASES);

  const platform = detectPlatform();
  const winCard = document.getElementById('card-windows');
  const apkCard = document.getElementById('card-android');

  if (platform === 'android' && apkCard) {
    apkCard.classList.add('card-highlighted');
  } else if (platform === 'windows' && winCard) {
    winCard.classList.add('card-highlighted');
  }

  await renderQr(DEFAULT_APK_URL, DEFAULT_VERSION);

  try {
    const fetchOpts: RequestInit = {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    };
    const [releasesSettled, latestSettled] = await Promise.allSettled([
      fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, fetchOpts),
      fetch(`https://api.github.com/repos/${REPO}/releases/latest`, fetchOpts),
    ]);

    const candidates: GitHubRelease[] = [];
    if (releasesSettled.status === 'fulfilled' && releasesSettled.value.ok) {
      const list = (await releasesSettled.value.json()) as GitHubRelease[];
      if (Array.isArray(list)) candidates.push(...list.filter((r) => !r.draft && !r.prerelease));
    }
    if (latestSettled.status === 'fulfilled' && latestSettled.value.ok) {
      const latestRel = (await latestSettled.value.json()) as GitHubRelease;
      if (latestRel && !latestRel.draft && !latestRel.prerelease) {
        const tag = normalizeVer(latestRel.tag_name || latestRel.name);
        if (tag && !candidates.some((c) => normalizeVer(c.tag_name || c.name) === tag)) {
          candidates.unshift(latestRel);
        }
      }
    }

    if (candidates.length === 0) return;

    candidates.sort((a, b) =>
      compareSemver(normalizeVer(b.tag_name || b.name), normalizeVer(a.tag_name || a.name)),
    );

    const rel = candidates[0];
    const ver = normalizeVer(rel.tag_name || rel.name) || DEFAULT_VERSION;

    if (compareSemver(ver, DEFAULT_VERSION) >= 0) {
      document.querySelectorAll('[data-version-pill]').forEach((el) => {
        el.textContent = `v${ver}`;
      });

      const assets = rel.assets ?? [];
      const exeAsset =
        assets.find((a) => a.name.toLowerCase().includes('portable') && a.name.toLowerCase().endsWith('.exe')) ??
        assets.find((a) => a.name.toLowerCase().endsWith('.exe'));
      const apkAsset = assets.find((a) => a.name.toLowerCase().endsWith('.apk'));

      if (exeAsset) {
        const btn = document.getElementById('btn-download-win') as HTMLAnchorElement | null;
        const meta = document.getElementById('meta-win');
        if (btn) btn.href = exeAsset.browser_download_url;
        if (meta) meta.textContent = `${exeAsset.name} · ${formatMb(exeAsset.size)}`;
      }

      const apkUrl =
        apkAsset?.browser_download_url ??
        `https://github.com/${REPO}/releases/download/v${ver}/KOMA-Android.apk`;
      const apkBtn = document.getElementById('btn-download-apk') as HTMLAnchorElement | null;
      const apkMeta = document.getElementById('meta-apk');
      if (apkBtn) apkBtn.href = apkUrl;
      if (apkMeta && apkAsset) apkMeta.textContent = `${apkAsset.name} · ${formatMb(apkAsset.size)}`;
      await renderQr(apkUrl, ver);
    }

    renderReleaseHistory(candidates);
  } catch {
    // Keep static fallback history & latest v1.1.1 QR target
  }
}

void init();
