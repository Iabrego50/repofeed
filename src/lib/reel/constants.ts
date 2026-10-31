export const REEL_W = 1080;
export const REEL_H = 1920;
export const FPS = 30;

export const SAFE = { left: 96, right: 950, top: 330, bottom: 1440 } as const;
export const SAFE_W = SAFE.right - SAFE.left;

export const TRACK_COLORS = [
  "#2F9BFF", // brand blue
  "#FFC23D", // amber
  "#FF6A3D", // coral
  "#3FE0A0", // mint
  "#B98CFF", // violet
  "#3FD6E0", // cyan
] as const;

export const INK = "#EEF3FB";
export const INK_MUTED = "rgba(238, 243, 251, 0.68)";
export const NEAR_BLACK = "#070B14";

export const FONT_DISPLAY = '"Bricolage Grotesque Variable", "Instrument Sans Variable", sans-serif';
export const FONT_UI = '"Instrument Sans Variable", system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

export function trackColor(index: number): string {
  return TRACK_COLORS[((index % TRACK_COLORS.length) + TRACK_COLORS.length) % TRACK_COLORS.length];
}

/** Mixes a hex color toward another by `amount` (0 = a, 1 = b). */
export function mixHex(a: string, b: string, amount: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const mix = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * amount);
  return `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`;
}

export function hexAlpha(hex: string, alpha: number): string {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255}, ${(p >> 8) & 255}, ${p & 255}, ${alpha})`;
}
