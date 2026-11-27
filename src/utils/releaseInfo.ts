export const APP_VERSION = '1.0.4';

export interface ChangelogSection {
  title: string;
  tone: 'features' | 'improvements' | 'fixes';
  items: string[];
}

export const DEFAULT_WHATS_NEW_NOTES = `### New Features
- **Zero-Knowledge Account Sync:** Sign up or sign in using only a Username + Password (no Google, no email). Everything is AES-256-GCM encrypted on your device before syncing across devices.
- **Open-Source Sync Worker:** Included lightweight Cloudflare Worker backend in sync-worker/ for free hosting or self-hosting.

### Improvements
- **Much Faster Bulk Migration:** Broken-source migration now searches 4 titles concurrently with smart early-exit instead of blasting all 8 sources sequentially.`;

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
