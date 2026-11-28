export const APP_VERSION = '1.1.2';

export interface ChangelogSection {
  title: string;
  tone: 'features' | 'improvements' | 'fixes';
  items: string[];
}

export const DEFAULT_WHATS_NEW_NOTES = `### Fixes
- **Sync Payload Compaction & Worker Guards:** Strips heavy cached chapter lists before encrypting sync vaults (~12x smaller) and adds CORS-safe error responses so PC (\`500\`) and Android (\`Failed to fetch\`) uploads succeed reliably.
- **No False Broken Mihon/Komikku Flags:** Stops flagging working \`mihon-\` entries as broken, adds \`COMICK_FUN\`/\`MANHUARM\`/\`MANGA_DEMON\` to known dead sources, and skips unverified/dead entries in \`Check Updates\` for faster checks.
- **Cross-Source Duplicate Merge & Kotatsu Progress:** Merging/migrating backups merges matching titles instead of creating duplicate entries, and Kotatsu history shows approximate \`~Ch. X\` progress.
- **Light Theme, Arabic RTL, Tablet & UX Polish:** Fixed Light Paper contrast across Explore/Spotlight/Reader/Splash, RTL truncation & tablet nav spacing, Download Modal \`Ch. 0\` labels, inline Sign In validation, and Welcome gate feed loading.`;

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
