import { z } from 'zod';
import { StatSchema, mono } from '../../schema/fields.ts';
import { formatMs } from '../../primitives/format.ts';

/**
 * Sequential stages where one eats the budget. Use for anything shaped like a
 * latency breakdown: request lifecycle, cold start, CI run, query plan.
 *
 * Distinct from `splitCompare` because there is no A/B here: there is one path,
 * and the point is *where inside it* the time goes. Trying to express that as a
 * comparison loses the whole argument.
 *
 * Drawn as a waterfall. Cycle 0 runs the path as it is; cycle 1 runs it with the
 * bottleneck fixed, so the bar shrinks, everything after it moves left and the
 * clock stops earlier. The rhythm follows the weights: you hear the handoffs.
 */
export const PipelineSchema = z.object({
  kind: z.literal('pipeline'),

  unitLabel: mono(14).describe("Left counter, e.g. 'STAGES DONE'."),
  clockLabel: mono(14).describe("Right counter, e.g. 'ELAPSED'."),

  /** Real duration of the whole path as it is, in ms. Drives the elapsed clock. */
  totalMs: z.number().positive().max(24 * 3600 * 1000),

  stages: z
    .array(
      z.object({
        name: mono(20).describe('SMALL CAPS. The stage.'),
        detail: mono(30).describe('Lower-case gloss. What happens here.'),
        cost: mono(8).describe("Its share of the time, e.g. '210ms'."),
        /** Share of the total. Must sum to 100 across all stages. */
        weight: z.number().min(4).max(92),
        /** Exactly one stage is the bottleneck. It renders amber; the rest mint. */
        bottleneck: z.boolean().optional(),
      }),
    )
    .min(3)
    .max(5)
    .describe('3 to 5 stages. More than 5 will not fit at 720px.'),

  /** The bottleneck once fixed, shown on the payoff cycle. */
  fix: z.object({
    /** Its new share, on the same scale as `weight` (the old total is 100). */
    weight: z.number().min(4).max(88),
    cost: mono(8).describe("Its new cost, e.g. '15ms'."),
    label: mono(16).describe("What changed, e.g. 'KEPT WARM'. Shown by the bar."),
  }),

  stat: StatSchema,
});

export type Pipeline = z.infer<typeof PipelineSchema>;

/** Rules a type cannot express. */
export function validate(stage: Pipeline): void {
  const sum = stage.stages.reduce((a, s) => a + s.weight, 0);
  if (Math.abs(sum - 100) > 0.001) {
    throw new Error(`stage.stages weights sum to ${sum}, must be exactly 100.`);
  }

  const bottlenecks = stage.stages.filter((s) => s.bottleneck);
  if (bottlenecks.length !== 1) {
    throw new Error(
      `stage.stages has ${bottlenecks.length} bottleneck(s), needs exactly one.\n` +
        `The reel is about the one stage that eats the budget.`,
    );
  }

  const b = bottlenecks[0];
  const rest = stage.stages.filter((s) => !s.bottleneck);
  if (rest.some((s) => s.weight >= b.weight)) {
    throw new Error(
      `bottleneck "${b.name}" (weight ${b.weight}) is not the heaviest stage.\n` +
        `If another stage costs as much, it is not the bottleneck.`,
    );
  }

  if (stage.fix.weight >= b.weight) {
    throw new Error(
      `fix.weight ${stage.fix.weight} must be below the bottleneck's weight ${b.weight}.`,
    );
  }
}

/** Budget lines printed by `npm run validate`. */
export function describe(stage: Pipeline): string[] {
  const b = stage.stages.find((s) => s.bottleneck)!;
  const after = 100 - b.weight + stage.fix.weight;
  return [
    `${stage.stages.length} stages, bottleneck "${b.name}" at ${b.weight}%`,
    `fixed path runs ${after}% of the original (${formatMs((stage.totalMs * after) / 100)})`,
  ];
}
