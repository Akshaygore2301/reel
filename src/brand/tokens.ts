/**
 * The channel's fixed visual identity. Sampled directly from the reference reel
 * (720x1280 @ 30fps) via a pixel histogram of frame 237.
 *
 * These do NOT vary per topic. Recognition in the feed comes from the palette
 * and chrome staying identical while the diagram changes.
 */

export const COLOR = {
  /** Page ground. Near-black with a blue cast, not pure #000. */
  ground: '#0B1118',
  /** One step up from ground, for inset screen faces. */
  groundInset: '#070C11',

  /**
   * SEMANTIC, not decorative. `slow` is always the naive/blocking/wrong path,
   * `fast` is always the correct/optimised one. Never swap them for variety.
   */
  slow: '#E8C06A',
  fast: '#7FD1B9',
  /** Shared machinery that belongs to neither path. */
  machine: '#7FC7F0',

  ink: '#F8F8F8',
  inkDim: '#8A9199',
  inkFaint: '#4A5158',
  accentLink: '#4A7FE8',

  /** Hairline rules and idle wireframe strokes. */
  rule: '#1C242E',
} as const;

/** Fill for a wireframe body: nearly transparent so the ground reads through. */
export const wireFill = (hex: string, alpha = 0.05) => withAlpha(hex, alpha);

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Frame size only. All timing lives in src/timeline/beats.ts — don't duplicate it here. */
export const VIDEO = {
  width: 720,
  height: 1280,
} as const;

/**
 * Type scale in px at 720x1280. The reference uses only two families:
 * a grotesk for prose and a mono for every label, number and code fragment.
 */
export const TYPE = {
  handle: 15,
  statLine: 13,
  title: 44,
  subtitle: 16,
  sectionLabel: 11,
  sectionSub: 11,
  counterLabel: 10,
  counterValue: 30,
  timerValue: 30,
  timerSub: 11,
  screenText: 11,
  lcd: 12,
  caption: 18,
  credit: 11,
  creditSmall: 10,
} as const;

/** Letter-spacing for the wide small-caps mono labels. */
export const TRACK = {
  wide: 2.2,
  wider: 3.0,
  normal: 0,
} as const;

export const LAYOUT = {
  /** Safe side margin. Reels crop nothing at 9:16 but UI overlays the edges. */
  gutter: 34,
  headerTop: 128,
  /** Vertical center of the diagram stage. */
  stageCenterY: 560,
  footerPillY: 940,
  footerRuleY: 995,
  footerCreditY: 1012,
} as const;

/** Slashed zero + tabular numbers, so counters don't jitter as digits change. */
export const MONO_FEATURES = {
  fontFeatureSettings: '"zero" 1, "tnum" 1',
  fontVariantNumeric: 'tabular-nums slashed-zero',
} as const;

/** JetBrains Mono advance width as a fraction of font size. Verified against a render. */
export const MONO_ADVANCE = 0.6;

/**
 * Largest font size at which `text` fits `maxWidth`, capped at `maxSize`.
 *
 * Because the family is monospaced the width is pure arithmetic — no DOM
 * measurement, so it is identical in Studio, in a still and in a render.
 *
 * This exists because length caps in the schema cannot protect a 78px-wide panel:
 * "3.0s = 3.0s" fits and "240ms = 240ms" does not, and both are legitimate content
 * for their topics. Shrinking beats rejecting.
 */
export function fitMono(text: string, maxWidth: number, maxSize: number, tracking = 0): number {
  if (text.length === 0) return maxSize;
  const perChar = MONO_ADVANCE * maxSize + tracking;
  const needed = text.length * perChar;
  if (needed <= maxWidth) return maxSize;
  // Solve maxWidth = len * (ADVANCE * size + tracking) for size.
  return Math.max(6, (maxWidth / text.length - tracking) / MONO_ADVANCE);
}
