import { z } from 'zod';

/**
 * Field builders shared by every archetype's schema. Caps are real: there is no
 * text reflow at 720px wide, so an over-long label silently overlaps its
 * neighbour.
 */

export const mono = (max: number) => z.string().min(1).max(max);

/** A short wide-tracked mono label plus its sentence-case gloss. */
export const LabelPair = z.object({
  label: mono(18).describe('SMALL CAPS MONO. Rendered upper-case and letter-spaced.'),
  sub: mono(34).describe('Lower-case gloss under the label. One short clause.'),
});

/**
 * The delta panel revealed on the payoff cycle. The win on top, the honest
 * caveat underneath. Every archetype has one: a reel with no caveat has
 * overstated its win.
 */
export const StatSchema = z.object({
  firstLabel: mono(14),
  firstBefore: mono(8).describe('Struck through.'),
  firstAfter: mono(8).describe('The win. Rendered mint.'),
  lastLabel: mono(14),
  lastText: mono(16).describe("The honest caveat, e.g. '3.0s = 3.0s'."),
});

export type Stat = z.infer<typeof StatSchema>;
