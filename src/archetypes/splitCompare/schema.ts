import { z } from 'zod';
// Explicit .ts extensions: this module is loaded by bare Node in scripts/, which
// does not do extensionless resolution. Webpack handles it either way.
import { LabelPair, StatSchema, mono } from '../../schema/fields.ts';
import { TIMING } from './timeline.ts';

/**
 * One source feeding two paths that differ only in whether they buffer. Use for
 * any "the same work, one way makes you wait for all of it" comparison.
 *
 * Hard rule a type cannot express, enforced in `validate` below: `payloads` must
 * contain EXACTLY `TIMING.tokens` words per entry. One word per click. A 29-word
 * sentence desynchronises the whole cycle.
 */
export const SplitCompareSchema = z.object({
  kind: z.literal('splitCompare'),

  /** The shared machine at the top that emits one unit at a time. */
  source: LabelPair,

  /** The buffer on the slow path. Its gloss changes when it opens. */
  buffer: LabelPair.extend({
    subOpen: mono(34).describe('Replaces `sub` the moment the buffer dumps.'),
  }),

  slow: z.object({
    title: mono(16).describe('SMALL CAPS. The naive approach. Rendered amber.'),
    sub: mono(34),
    waitLabel: mono(18).describe("Under the climbing timer, e.g. 'still waiting'."),
  }),

  fast: z.object({
    title: mono(16).describe('SMALL CAPS. The correct approach. Rendered mint.'),
    sub: mono(34),
  }),

  counterLabel: mono(14).describe("Above both counters, e.g. \"YOU'VE READ\"."),

  /**
   * One sentence per cycle, typed out one word per click. Each must be exactly
   * TIMING.tokens words so the last word lands on the last click.
   */
  payloads: z
    .array(z.string())
    .length(TIMING.cycles)
    .describe(`One sentence per cycle, each exactly ${TIMING.tokens} words.`),

  stat: StatSchema,
});

export type SplitCompare = z.infer<typeof SplitCompareSchema>;

/**
 * Screen-face text budget.
 *
 * There is no reflow or auto-shrink at 720px: a payload that is too long simply
 * gets its last line clipped by `overflow: hidden`, which is invisible in the
 * first half of the reel and obvious in the second. Better to refuse it here.
 *
 * Calibrated against a real render, not derived on paper: a 1269px payload lays out
 * in exactly 8 lines inside the face with a little room under the last one, so 8
 * lines is the true capacity. The other figures are the measured layout: 196px of
 * usable width per line, JetBrains Mono at 10.5px (0.6em advance), each word wrapped
 * in a chip costing 8px of padding and border plus a 3px gap, discounted because
 * word wrapping never packs a line completely full.
 *
 * Passing at 99% is passing. Aim for under 90% so a later copy edit does not tip a
 * scene over.
 */
const CHAR_ADVANCE = 6.3;
const CHIP_OVERHEAD = 11;
const USABLE_LINE_PX = 196;
const USABLE_LINES = 8;
const PACKING_EFFICIENCY = 0.86;
const TEXT_BUDGET_PX = USABLE_LINE_PX * USABLE_LINES * PACKING_EFFICIENCY;

function payloadWidth(words: string[]): number {
  return words.reduce((sum, w) => sum + w.length * CHAR_ADVANCE + CHIP_OVERHEAD, 0);
}

/** The rules a type cannot express: exact word count, and whether the text fits. */
export function validate(stage: SplitCompare): void {
  stage.payloads.forEach((p, i) => {
    const words = p.trim().split(/\s+/);

    if (words.length !== TIMING.tokens) {
      throw new Error(
        `stage.payloads[${i}] has ${words.length} words, needs exactly ${TIMING.tokens}.\n` +
          `One word per click. Any other count desynchronises the whole cycle.`,
      );
    }

    const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
    if (longest.length > 14) {
      throw new Error(
        `stage.payloads[${i}] contains "${longest}" (${longest.length} chars).\n` +
          `Max 14. A longer word overflows the screen face on its own line.`,
      );
    }

    const px = payloadWidth(words);
    if (px > TEXT_BUDGET_PX) {
      throw new Error(
        `stage.payloads[${i}] needs ~${Math.round(px)}px of chip width, budget is ` +
          `${Math.round(TEXT_BUDGET_PX)}px (${Math.round((px / TEXT_BUDGET_PX) * 100)}%).\n` +
          `Shorten the words: same 30-word count, fewer characters.`,
      );
    }
  });
}

/** Human-readable utilisation, so an author can see how close to the edges they are. */
export function describe(stage: SplitCompare): string[] {
  return stage.payloads.map((p, i) => {
    const words = p.trim().split(/\s+/);
    const pct = Math.round((payloadWidth(words) / TEXT_BUDGET_PX) * 100);
    const chars = words.join('').length;
    return `payload ${i}: ${words.length} words, ${chars} chars, ${pct}% of screen budget`;
  });
}
