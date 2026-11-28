import QRCode from 'qrcode';

const REPO = 'nourddinachi20-rgb/KOMA';
const DEFAULT_VERSION = '1.0.8';
const DEFAULT_APK_URL = `https://github.com/${REPO}/releases/latest/download/KOMA-Android.apk`;

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name?: string;
  name?: string;
  body?: string;
  published_at?: string;
  assets?: GitHubReleaseAsset[];
}

const FALLBACK_RELEASES: GitHubRelease[] = [
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

async function renderQr(url: string): Promise<void> {
  const container = document.getElementById('apk-qr');
  if (!container) return;
  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: 108,
      margin: 1,
      color: { dark: '#FFFFFF', light: '#0A0A0D' },
    });
    container.innerHTML = svg;
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

  await renderQr(DEFAULT_APK_URL);

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return;
    const list = (await res.json()) as GitHubRelease[];
    if (!Array.isArray(list) || list.length === 0) return;

    const rel = list[0];
    const ver = (rel.tag_name || rel.name || DEFAULT_VERSION).replace(/^v/i, '').trim();

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

    if (apkAsset) {
      const btn = document.getElementById('btn-download-apk') as HTMLAnchorElement | null;
      const meta = document.getElementById('meta-apk');
      if (btn) btn.href = apkAsset.browser_download_url;
      if (meta) meta.textContent = `${apkAsset.name} · ${formatMb(apkAsset.size)}`;
      await renderQr(apkAsset.browser_download_url);
    }

    renderReleaseHistory(list);
  } catch {
    // Keep static fallback history
  }
}

void init();
