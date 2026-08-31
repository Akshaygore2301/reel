import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

/**
 * Both families are loaded at module scope so Remotion's font-waiting logic
 * blocks the first frame until glyphs are ready. Rendering before load causes
 * a one-frame fallback-font flash that shows up in the MP4.
 */
const inter = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });
const mono = loadMono('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });

export const FONT = {
  /** Grotesk. Headings, subtitle, caption prose. */
  sans: inter.fontFamily,
  /** Fixed-width. Every label, counter, timer and code fragment. */
  mono: mono.fontFamily,
} as const;

export const waitForFonts = () => Promise.all([inter.waitUntilDone(), mono.waitUntilDone()]);
