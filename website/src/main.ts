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

function renderReleaseNotes(markdown: string, version: string): void {
  const heading = document.getElementById('whats-new-title');
  if (heading) heading.textContent = `Changelog · v${version}`;

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
        cur = { title: 'Changes', items: [] };
        sections.push(cur);
      }
      cur.items.push(b[1].replace(/\*\*/g, '').trim());
    }
  }

  if (sections.length === 0) return;
  container.innerHTML = sections
    .map(
      (sec) => `
      <div class="card-surface">
        <div class="mono notes-title">${sec.title.replace(/</g, '&lt;')}</div>
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

  if (platform === 'android' && apkCard) {
    apkCard.classList.add('card-highlighted');
  } else if (platform === 'windows' && winCard) {
    winCard.classList.add('card-highlighted');
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
    // Keep static defaults
  }
}

void init();
