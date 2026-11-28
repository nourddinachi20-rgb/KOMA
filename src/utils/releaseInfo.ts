export const APP_VERSION = '1.1.7';

export interface ChangelogSection {
  title: string;
  tone: 'features' | 'improvements' | 'fixes';
  items: string[];
}

export const DEFAULT_WHATS_NEW_NOTES = `### Fixes
- **Fixed Sources Showing (0) & Boot Race:** Attaches engine status listeners before initial hydration and always re-checks/restarts the engine when Refresh is clicked so all verified sources load immediately on launch and after updates.
- **Full-Screen Sources via Settings:** Clicking **Sources** inside Settings now opens the full-screen Sources view with a Back button back to Settings and a 18+ filter toggle.
- **Single-Row Library Header:** Groups Library, Updates, and Offline into a compact segmented pill aligned on one line alongside the Filter, Stats, and More buttons.`;

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
