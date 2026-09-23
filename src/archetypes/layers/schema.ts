import { z } from 'zod';
import { StatSchema, mono } from '../../schema/fields.ts';
import { formatMs } from '../../primitives/format.ts';

/**
 * A stack of places that can answer, fastest on top. Use when the argument is
 * "the closer the answer, the less you pay": a CDN in front of an origin, a
 * cache in front of a database, CPU caches in front of RAM.
 *
 * Drawn as slabs that widen as they get slower (small and fast on top, big and
 * slow at the bottom). Cycle 0 is cold: the request misses every layer, pays for
 * the trip to the bottom, and on the way back the answer is stored in
 * `hitLayer`. Cycle 1 is warm: the same request stops at `hitLayer`, and every
 * layer below it is never touched.
 *
 * Distinct from `splitCompare`'s cache hit vs cold read: that is two paths side
 * by side. This is one path with depth, and the point is how many layers the
 * answer saves you.
 */
export const LayersSchema = z.object({
  kind: z.literal('layers'),

  unitLabel: mono(14).describe("Left counter, e.g. 'LAYERS ASKED'."),
  clockLabel: mono(14).describe("Right counter, e.g. 'LATENCY'."),

  layers: z
    .array(
      z.object({
        name: mono(14).describe('SMALL CAPS. The layer, e.g. "CDN EDGE".'),
        detail: mono(26).describe('Lower-case gloss, e.g. "a server near the user".'),
        /** What asking this layer costs, in ms. Sub-ms is fine: 0.000001 is 1ns. */
        ms: z.number().positive().max(24 * 3600 * 1000),
      }),
    )
    .min(3)
    .max(5)
    .describe('3 to 5 layers, fastest first. The last one is the origin: it always has the answer.'),

  /** Index of the layer that answers on the warm cycle. Never the origin. */
  hitLayer: z.number().int().min(0),

  stat: StatSchema,
});

export type Layers = z.infer<typeof LayersSchema>;

export const coldMs = (stage: Layers) => stage.layers.reduce((a, l) => a + l.ms, 0);
export const warmMs = (stage: Layers) => stage.layers.slice(0, stage.hitLayer + 1).reduce((a, l) => a + l.ms, 0);

/** Rules a type cannot express. */
export function validate(stage: Layers): void {
  const { layers, hitLayer } = stage;
  if (hitLayer > layers.length - 2) {
    throw new Error(
      `hitLayer ${hitLayer} must be 0..${layers.length - 2}. The last layer is the origin; ` +
        `a "hit" there is just the cold path.`,
    );
  }
  for (let i = 1; i < layers.length; i++) {
    if (layers[i].ms <= layers[i - 1].ms) {
      throw new Error(
        `layer "${layers[i].name}" (${layers[i].ms}ms) must be slower than "${layers[i - 1].name}" ` +
          `(${layers[i - 1].ms}ms) above it. Layers go fastest first.`,
      );
    }
  }
}

/** Budget lines printed by `npm run validate`. */
export function describe(stage: Layers): string[] {
  return [
    `${stage.layers.length} layers, warm hit at "${stage.layers[stage.hitLayer].name}"`,
    `cold: ${formatMs(coldMs(stage))}, warm: ${formatMs(warmMs(stage))}`,
  ];
}
