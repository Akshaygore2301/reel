import { z } from 'zod';
import { LabelPair, StatSchema, mono } from '../../schema/fields.ts';
import { POOL_SIZE, REQUESTS } from './timeline.ts';

/**
 * A pooled resource that has to come back. Use when the bug is a missing
 * release: connection leaks, TCP sockets stuck in TIME_WAIT, file descriptors
 * never closed, locks never unlocked, goroutines never joined.
 *
 * Drawn as a loop: the pool at the top, a row of states below it, a leg down
 * into the first state and a leg back up from the last. On the leaking cycle
 * every resource parks in `stuckState`, the pool drains, and the next request
 * blocks. On the fixed cycle each one runs the whole loop and returns, and the
 * pool never runs dry under the same traffic.
 *
 * Do not use it for "one thing is slow" (that is `pipeline`) or "we ran out of
 * capacity" with nothing leaking (that is `scaleOut`).
 */
export const LifecycleSchema = z.object({
  kind: z.literal('lifecycle'),

  /** The pool, named above its slots. */
  pool: LabelPair.describe(`E.g. { label: 'CONNECTION POOL', sub: '${POOL_SIZE} connections, shared' }.`),

  freeLabel: mono(14).describe("Left counter: free slots, e.g. 'FREE CONNS'."),
  waitLabel: mono(14).describe("Right counter: requests blocked, e.g. 'WAITING'."),

  states: z
    .array(
      z.object({
        name: mono(12).describe('SMALL CAPS. The state, e.g. "TIME_WAIT".'),
        detail: mono(24).describe('Lower-case gloss, wraps to two lines.'),
      }),
    )
    .min(3)
    .max(5)
    .describe('3 to 5 states, in the order a resource passes through them.'),

  /** Index of the state a resource never leaves on the leaking cycle. */
  stuckState: z.number().int().min(0),

  fixLabel: mono(14).describe("What makes it leave the stuck state, e.g. 'defer close()'. Shown on the fixed cycle."),

  stat: StatSchema,
});

export type Lifecycle = z.infer<typeof LifecycleSchema>;

/** Rules a type cannot express. */
export function validate(stage: Lifecycle): void {
  if (stage.stuckState > stage.states.length - 1) {
    throw new Error(`stuckState ${stage.stuckState} must be 0..${stage.states.length - 1}.`);
  }
}

/** Budget lines printed by `npm run validate`. */
export function describe(stage: Lifecycle): string[] {
  return [
    `${stage.states.length} states, leaks in "${stage.states[stage.stuckState].name}"`,
    `${REQUESTS} requests against a pool of ${POOL_SIZE}: ${REQUESTS - POOL_SIZE} block on the leaking cycle`,
  ];
}
