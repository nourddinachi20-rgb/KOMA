import type { AppSettings, UiLanguage, UiTheme } from '../types';

export interface AccentPreset {
  id: string;
  label: string;
  hex: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'white', label: 'Pure White', hex: '#FFFFFF' },
  { id: 'silver', label: 'Silver', hex: '#D4D4D8' },
  { id: 'crimson', label: 'Crimson', hex: '#EF4444' },
  { id: 'cobalt', label: 'Cobalt', hex: '#3B82F6' },
  { id: 'emerald', label: 'Emerald', hex: '#10B981' },
  { id: 'violet', label: 'Violet', hex: '#8B5CF6' },
  { id: 'gold', label: 'Gold', hex: '#EAC278' },
];

export const DEFAULT_ACCENT_COLOR = '#FFFFFF';
export const DEFAULT_UI_THEME: UiTheme = 'oled';
export const DEFAULT_UI_LANGUAGE: UiLanguage = 'en';

function normalizeHex(hex: string | undefined): string {
  if (!hex || typeof hex !== 'string') return DEFAULT_ACCENT_COLOR;
  const cleaned = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) return cleaned.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(cleaned)) {
    const [, r, g, b] = cleaned;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return DEFAULT_ACCENT_COLOR;
}

function hexToRgb(hex: string): [number, number, number] {
  const norm = normalizeHex(hex);
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  return [r, g, b];
}

function getContrastForeground(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  // Relative WCAG luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#000000' : '#FFFFFF';
}

export function applyCustomizationToDocument(
  settings: Pick<AppSettings, 'uiTheme' | 'accentColor' | 'uiLanguage'>,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const theme: UiTheme =
    settings.uiTheme === 'dark' || settings.uiTheme === 'paper' ? settings.uiTheme : 'oled';
  const lang: UiLanguage =
    settings.uiLanguage === 'fr' || settings.uiLanguage === 'ar' ? settings.uiLanguage : 'en';

  const rawAccent = normalizeHex(settings.accentColor);
  // On light "paper" theme, pure #FFFFFF accent would vanish on white cards; auto-flip to ink black (#09090D)
  const effectiveAccent = theme === 'paper' && rawAccent === '#FFFFFF' ? '#09090D' : rawAccent;
  const [r, g, b] = hexToRgb(effectiveAccent);
  const accentFg = getContrastForeground(effectiveAccent);

  root.dataset.theme = theme;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';

  root.style.setProperty('--koma-accent', effectiveAccent);
  root.style.setProperty('--koma-accent-fg', accentFg);
  root.style.setProperty('--koma-accent-rgb', `${r}, ${g}, ${b}`);

  if (theme === 'paper') {
    root.style.setProperty('--koma-bg', '#F4F4F6');
    root.style.setProperty('--koma-surface', '#FFFFFF');
    root.style.setProperty('--koma-text', '#09090D');
  } else if (theme === 'dark') {
    root.style.setProperty('--koma-bg', '#101116');
    root.style.setProperty('--koma-surface', '#181A22');
    root.style.setProperty('--koma-text', '#F5F5F7');
  } else {
    root.style.setProperty('--koma-bg', '#000000');
    root.style.setProperty('--koma-surface', '#08080C');
    root.style.setProperty('--koma-text', '#FFFFFF');
  }
}
