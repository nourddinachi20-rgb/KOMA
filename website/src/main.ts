import QRCode from 'qrcode';

const REPO = 'nourddinachi20-rgb/KOMA';
const DEFAULT_VERSION = '1.0.0';
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
  assets?: GitHubReleaseAsset[];
}

const SHOWCASE_SCREENS: Record<
  string,
  { src: string; caption: string; tag: string }
> = {
  home: {
    src: './screenshots/desktop-home.png',
    caption: 'Trending Hero Spotlight with advance bar, hourly feeds & Continue Reading',
    tag: 'HOME SPOTLIGHT',
  },
  details: {
    src: './screenshots/desktop-details.png',
    caption: 'Series Page with AniList Related & Recommended cards + 30-chapter pagination',
    tag: 'SERIES & CHAPTERS',
  },
  reader: {
    src: './screenshots/desktop-reader.png',
    caption: 'Distraction-free OLED Reader with Webtoon/RTL/Spread modes, Zoom & Cruise',
    tag: 'OLED PRO READER',
  },
  explore: {
    src: './screenshots/tablet-explore.png',
    caption: '100+ verified EN/FR/AR sources including MangaBall, MangaDex, Asura & WeebCentral',
    tag: 'EXPLORE CATALOG',
  },
};

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function renderQr(url: string): Promise<void> {
  const container = document.getElementById('apk-qr');
  if (!container) return;
  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: 118,
      margin: 1,
      color: { dark: '#FFFFFF', light: '#0A0A0D' },
    });
    container.innerHTML = svg;
  } catch {
    container.textContent = 'QR ready';
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

function renderReleaseNotes(markdown: string, version: string): void {
  const heading = document.getElementById('whats-new-title');
  if (heading) heading.textContent = `What's New in ver : ${version}`;

  const container = document.getElementById('release-notes-grid');
  if (!container || !markdown.trim()) return;

  const sections: Array<{ title: string; items: string[] }> = [];
  let cur: { title: string; items: string[] } | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^#{1,4}\s+(.+)$/);
    if (h) {
      cur = { title: h[1].trim(), items: [] };
      sections.push(cur);
      continue;
    }
    const b = line.match(/^[-*•]\s+(.+)$/);
    if (b) {
      if (!cur) {
        cur = { title: 'Highlights', items: [] };
        sections.push(cur);
      }
      cur.items.push(b[1].replace(/\*\*/g, '').trim());
    }
  }

  if (sections.length === 0) return;
  container.innerHTML = sections
    .map(
      (sec) => `
      <div class="card-surface p-6">
        <div class="badge-mono mb-4">${sec.title.replace(/</g, '&lt;')}</div>
        <ul class="notes-list">
          ${sec.items
            .map(
              (item) => `
            <li>
              <span class="dot-white"></span>
              <span>${item.replace(/</g, '&lt;')}</span>
            </li>`,
            )
            .join('')}
        </ul>
      </div>`,
    )
    .join('');
}

async function init(): Promise<void> {
  initShowcaseTabs();

  const platform = detectPlatform();
  const winCard = document.getElementById('card-windows');
  const apkCard = document.getElementById('card-android');
  const osBadge = document.getElementById('detected-os-pill');

  if (platform === 'android' && apkCard && osBadge) {
    apkCard.classList.add('card-recommended');
    osBadge.textContent = 'Detected Android Device · APK Ready';
  } else if (platform === 'windows' && winCard && osBadge) {
    winCard.classList.add('card-recommended');
    osBadge.textContent = 'Detected Windows PC · Portable EXE Ready';
  }

  await renderQr(DEFAULT_APK_URL);

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return;
    const rel = (await res.json()) as GitHubRelease;
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

    if (rel.body) {
      renderReleaseNotes(rel.body, ver);
    }
  } catch {
    // Static defaults stay active
  }
}

void init();
