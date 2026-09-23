import { z } from 'zod';
import { StatSchema, mono } from '../../schema/fields.ts';
import { formatMs } from '../../primitives/format.ts';

/**
 * Independent calls, made one after another vs all at once. Use when the work
 * does not depend on itself: parallel API calls, Promise.all, scatter-gather,
 * sharded test runs.
 *
 * Distinct from `pipeline`: there the stages depend on each other and the point
 * is which one eats the time. Here nothing depends on anything, and the point
 * is that waiting for them in turn costs the SUM, while fanning out costs only
 * the SLOWEST.
 *
 * Drawn as two waterfalls on one time axis. The top lane runs the calls in
 * sequence; the bottom lane fires them together and joins when the slowest
 * returns. Both run on every cycle, so the gap between the two finish lines is
 * on screen the whole time.
 */
export const FanOutSchema = z.object({
  kind: z.literal('fanOut'),

  clockLabel: mono(14).describe("Above both elapsed clocks, e.g. 'ELAPSED'."),

  calls: z
    .array(
      z.object({
        name: mono(16).describe('SMALL CAPS. The call, e.g. "GET /user".'),
        cost: mono(8).describe("How long it takes, e.g. '120ms'."),
        /** Share of the sequential total. Must sum to 100 across all calls. */
        weight: z.number().min(8).max(60),
      }),
    )
    .min(3)
    .max(5)
    .describe('3 to 5 independent calls.'),

  /** Real duration of all the calls made in turn, in ms. Drives both clocks. */
  totalMs: z.number().positive().max(24 * 3600 * 1000),

  seq: z.object({
    title: mono(14).describe('SMALL CAPS. One after another. Rendered amber.'),
    sub: mono(30).describe("Lower-case gloss, e.g. 'await each call in turn'."),
  }),

  par: z.object({
    title: mono(14).describe('SMALL CAPS. All at once. Rendered mint.'),
    sub: mono(30),
    join: mono(14).describe("What waits for them all, e.g. 'Promise.all'. Marks the join."),
  }),

  stat: StatSchema,
});

export type FanOut = z.infer<typeof FanOutSchema>;

/** Rules a type cannot express. */
export function validate(stage: FanOut): void {
  const sum = stage.calls.reduce((a, c) => a + c.weight, 0);
  if (Math.abs(sum - 100) > 0.001) {
    throw new Error(`stage.calls weights sum to ${sum}, must be exactly 100.`);
  }
}

/** Budget lines printed by `npm run validate`. */
export function describe(stage: FanOut): string[] {
  const slowest = stage.calls.reduce((a, c) => (c.weight > a.weight ? c : a));
  return [
    `${stage.calls.length} calls, slowest "${slowest.name}" at ${slowest.weight}%`,
    `in turn: ${formatMs(stage.totalMs)}, fanned out: ${formatMs((stage.totalMs * slowest.weight) / 100)}`,
  ];
}
