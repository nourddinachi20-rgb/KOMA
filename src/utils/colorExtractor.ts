const colorCache = new Map<string, string>();
const DEFAULT_AMBIENT = '212, 182, 130'; // Warm champagne gold fallback

/**
 * Samples a cover image on an offscreen canvas and extracts a rich, saturated
 * ambient RGB triplet ("r, g, b") so every series radiates its own atmosphere.
 */
export async function extractAmbientColor(imageUrl: string | null | undefined): Promise<string> {
  if (!imageUrl) return DEFAULT_AMBIENT;
  const cached = colorCache.get(imageUrl);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 24;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(DEFAULT_AMBIENT);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let bestScore = -1;
        let bestR = 212;
        let bestG = 182;
        let bestB = 130;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 180) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 510;
          const d = max - min;
          const s = max === 0 ? 0 : d / max;

          // Prefer vibrant mid-tones that glow cleanly on #000000 OLED black
          if (l < 0.16 || l > 0.86) continue;
          const score = s * 2.2 + (1 - Math.abs(l - 0.5)) * 0.6;
          if (score > bestScore) {
            bestScore = score;
            bestR = r;
            bestG = g;
            bestB = b;
          }
        }

        // Lift dark colors slightly so they always read cleanly against pure OLED black
        const factor = Math.max(bestR, bestG, bestB) < 120 ? 1.45 : 1;
        const rgb = `${Math.min(255, Math.round(bestR * factor))}, ${Math.min(
          255,
          Math.round(bestG * factor),
        )}, ${Math.min(255, Math.round(bestB * factor))}`;

        colorCache.set(imageUrl, rgb);
        resolve(rgb);
      } catch {
        resolve(DEFAULT_AMBIENT);
      }
    };
    img.onerror = () => resolve(DEFAULT_AMBIENT);
    img.src = imageUrl;
  });
}
