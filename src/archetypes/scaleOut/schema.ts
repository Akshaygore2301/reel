import { z } from 'zod';
import { LabelPair, StatSchema, mono } from '../../schema/fields.ts';

/**
 * One thing made bigger vs more things side by side. Use when capacity runs out
 * and the two answers are "replace it with a larger one" or "add another":
 * vertical vs horizontal scaling, a bigger database vs sharding, a faster
 * worker vs a worker pool.
 *
 * The same traffic feeds both sides. Both saturate at the same moment. The up
 * side has to go offline to grow, and requests pile up until it returns; the out
 * side adds an identical node behind its router and never stops serving.
 *
 * Do not use it when the argument is about speed per request: neither side
 * gets faster, and the stat caveat should say so.
 */
export const ScaleOutSchema = z.object({
  kind: z.literal('scaleOut'),

  /** The shared source at the top. */
  source: LabelPair,

  counterLabel: mono(14).describe("Above both counters, e.g. 'REQUESTS DONE'."),

  up: z.object({
    title: mono(16).describe('SMALL CAPS. Growing the one box. Rendered amber.'),
    sub: mono(34),
    unit: mono(10).describe("The box's size before, e.g. '4 vCPU'."),
    unitAfter: mono(10).describe("Its size after the resize, e.g. '16 vCPU'."),
    offlineLabel: mono(14).describe("Shown while it is down, e.g. 'resizing'."),
  }),

  out: z.object({
    title: mono(16).describe('SMALL CAPS. Adding boxes. Rendered mint.'),
    sub: mono(34),
    unit: mono(10).describe("Each node's size, e.g. '4 vCPU'. Same as up.unit, usually."),
    router: mono(12).describe("The thing spreading work, e.g. 'BALANCER'."),
    spawnLabel: mono(10).describe("Tag on the new node, e.g. '+1 NODE'."),
  }),

  stat: StatSchema,
});

export type ScaleOut = z.infer<typeof ScaleOutSchema>;

/** No rules beyond the types: the rhythm is fixed and nothing is typed out. */
export function validate(): void {}

export function describe(stage: ScaleOut): string[] {
  return [`up: ${stage.up.unit} -> ${stage.up.unitAfter}, out: +1 x ${stage.out.unit}`];
}
