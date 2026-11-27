export const APP_VERSION = '1.0.0';

export interface ChangelogSection {
  title: string;
  tone: 'features' | 'improvements' | 'fixes';
  items: string[];
}

export const DEFAULT_WHATS_NEW_NOTES = `### New Features
- **Android Phone & Tablet App:** Native embedded Kotlin parser engine, adaptive bottom dock & tablet rails, touch pinch-to-zoom, and WebView Cloudflare solver.
- **In-App GitHub Auto-Updater:** Check version & update both Windows (.exe) and Android (.apk) straight from Settings with automatic restart.
- **Interactive Onboarding Tour:** Guided step-by-step walkthrough of Hero spotlight, Explore sources, Pro OLED Reader, and Offline Sanctuary.
- **In-Reader Chapter List & Page Scrubber:** Jump chapters mid-read (C) and scrub with live page tooltips.

### Improvements & Performance
- **Zero-Blur OLED Compositing:** Pure CSS radial lighting, instant native Windows fonts, and 0ms persistent core tabs.
- **Tilted Manga Cover Intro:** Instant SSD-cached manga cover wall featuring "Made by VirtualDrum".
- **Curated Trending Feeds:** Hero Spotlight and Home shelves locked to top popularity rankings across MangaBall, MangaDex, AsuraScans, and WeebCentral.

### Bug Fixes
- **Cover Loading Race on Boot:** Eliminated pre-boot external cover hotlink failures and added exponential retry + Kotlin host semaphores.
- **AniList Title Lookup:** Stripped source tags like (LICO) and added altTitles fallback so Related Entries & Recommendations load reliably.`;

export function parseChangelogSections(rawMarkdown?: string | null): ChangelogSection[] {
  const source = rawMarkdown?.trim() ? rawMarkdown : DEFAULT_WHATS_NEW_NOTES;
  const lines = source.split(/\r?\n/);
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;

  const detectTone = (heading: string): ChangelogSection['tone'] => {
    const h = heading.toLowerCase();
    if (h.includes('fix') || h.includes('bug')) return 'fixes';
    if (h.includes('improv') || h.includes('perf') || h.includes('optim') || h.includes('polish')) {
      return 'improvements';
    }
    return 'features';
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      const title = headingMatch[1].trim();
      current = { title, tone: detectTone(title), items: [] };
      sections.push(current);
      continue;
    }
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (!current) {
        current = { title: 'Highlights', tone: 'features', items: [] };
        sections.push(current);
      }
      current.items.push(bulletMatch[1].trim());
    } else if (current && line.length > 0 && !line.startsWith('>')) {
      current.items.push(line);
    }
  }

  return sections.filter((s) => s.items.length > 0);
}
