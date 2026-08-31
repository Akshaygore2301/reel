import { z } from 'zod';
// Explicit .ts extension: this module is loaded by bare Node in scripts/, which
// does not do extensionless resolution. Webpack handles it either way.
import { TIMING } from '../timeline/beats.ts';

/**
 * The contract for a reel. Everything topic-specific lives here; everything
 * visual and temporal lives in code. An authored scene is pure content.
 *
 * Hard rules encoded below, because they are the ones an author (human or LLM)
 * gets wrong:
 *
 *  1. `payloads` must contain EXACTLY `TIMING.tokens` words per entry. One word
 *     per click. A 29-word sentence desynchronises the whole cycle.
 *  2. Nothing may exceed its length cap. There is no text reflow at 720px wide;
 *     an over-long label silently overlaps its neighbour.
 *  3. Colour is assigned by the archetype, never by the author. `slow` is always
 *     amber, `fast` always mint. See prompts/author-scene.md.
 */

const mono = (max: number) => z.string().min(1).max(max);

/** A short wide-tracked mono label plus its sentence-case gloss. */
const LabelPair = z.object({
  label: mono(18).describe('SMALL CAPS MONO. Rendered upper-case and letter-spaced.'),
  sub: mono(34).describe('Lower-case gloss under the label. One short clause.'),
});

export const CaptionAnchorSchema = z
  .union([
    z.object({
      cycle: z.number().int().min(0).max(TIMING.cycles - 1),
      token: z.number().int().min(1).max(TIMING.tokens),
    }),
    z.object({
      cycle: z.number().int().min(0).max(TIMING.cycles - 1),
      on: z.enum(['dump', 'payoff', 'reset']),
    }),
  ])
  .describe('When the caption swaps in — anchored to a beat, never a raw frame.');

export const CaptionSchema = z.object({
  at: CaptionAnchorSchema,
  text: mono(52).describe('Sentence case, ends with . or ?. This is the line people read.'),
});

/**
 * The reference archetype: one source feeding two paths that differ only in
 * whether they buffer. Use for any "naive vs correct" comparison.
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

  /** The delta panel revealed between the screens on the payoff cycle. */
  stat: z.object({
    firstLabel: mono(14),
    firstBefore: mono(8).describe('Struck through.'),
    firstAfter: mono(8).describe('The win. Rendered mint.'),
    lastLabel: mono(14),
    lastText: mono(16).describe("The honest caveat, e.g. '3.0s = 3.0s'."),
  }),
});

/**
 * Sequential stages where one eats the budget. Use for anything shaped like a
 * latency breakdown: request lifecycle, cold start, CI run, query plan.
 *
 * Distinct from `splitCompare` because there is no A/B here — there is one path,
 * and the point is *where inside it* the time goes. Trying to express that as a
 * comparison loses the whole argument.
 */
export const PipelineSchema = z.object({
  kind: z.literal('pipeline'),

  unitLabel: mono(14).describe("Left counter, e.g. 'STAGES DONE'."),
  clockLabel: mono(14).describe("Right counter, e.g. 'ELAPSED'."),

  stages: z
    .array(
      z.object({
        name: mono(20).describe('SMALL CAPS. The stage.'),
        detail: mono(30).describe('Lower-case gloss. What happens here.'),
        cost: mono(8).describe("Its share of the time, e.g. '210ms'."),
        /** Share of the total. Must sum to 100 across all stages. */
        weight: z.number().min(1).max(97),
        /** Exactly one stage is the bottleneck. It renders amber; the rest mint. */
        bottleneck: z.boolean().optional(),
      }),
    )
    .min(3)
    .max(5)
    .describe('3 to 5 stages. More than 5 will not fit at 720px.'),

  stat: z.object({
    firstLabel: mono(14),
    firstBefore: mono(8).describe('The total. Struck through.'),
    firstAfter: mono(8).describe('What it becomes once the bottleneck is fixed.'),
    lastLabel: mono(14),
    lastText: mono(16).describe('The caveat — the floor you cannot get under.'),
  }),
});

export const StageSchema = z.discriminatedUnion('kind', [SplitCompareSchema, PipelineSchema]);

export const SceneSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case; becomes the composition id and output filename'),

  handle: z.string().startsWith('@'),

  header: z.object({
    /** The mono stat line above the title: LABEL · slow vs fast */
    stat: z.object({
      label: mono(16),
      slow: mono(8),
      fast: mono(8),
    }),
    /** Two-tone title. `lead` renders white, `accent` mint. */
    title: z.object({
      lead: mono(14),
      accent: mono(16),
    }),
    subtitle: mono(46).describe('Lower case, one line. The promise of the reel.'),
  }),

  stage: StageSchema,

  captions: z.array(CaptionSchema).min(2).max(6),

  /** Revealed with the stinger on the payoff cycle. */
  credits: z.object({
    lead: mono(14).describe('Mint. The concept name.'),
    tail: mono(40).describe('Dim. The one-line definition.'),
    tags: z.array(mono(12)).min(2).max(5).describe('Who does this. Joined with ·.'),
  }),
});

export type Scene = z.infer<typeof SceneSchema>;
export type SplitCompare = z.infer<typeof SplitCompareSchema>;
export type Pipeline = z.infer<typeof PipelineSchema>;
export type Caption = z.infer<typeof CaptionSchema>;

/**
 * Screen-face text budget.
 *
 * There is no reflow or auto-shrink at 720px: a payload that is too long simply
 * gets its last line clipped by `overflow: hidden`, which is invisible in the
 * first half of the reel and obvious in the second. Better to refuse it here.
 *
 * Calibrated against a real render, not derived on paper: a 1269px payload lays out
 * in exactly 8 lines inside the face with a little room under the last one, so 8
 * lines is the true capacity. The other figures are the measured layout — 196px of
 * usable width per line, JetBrains Mono at 10.5px (0.6em advance), each word wrapped
 * in a chip costing 8px of padding and border plus a 3px gap — discounted because
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

/**
 * The rules a type cannot express: exact word count, and whether the text
 * physically fits the screen it is typed into.
 */
export function validateScene(input: unknown): Scene {
  const scene = SceneSchema.parse(input);

  if (scene.stage.kind === 'splitCompare') {
    scene.stage.payloads.forEach((p, i) => {
      const words = p.trim().split(/\s+/);

      if (words.length !== TIMING.tokens) {
        throw new Error(
          `stage.payloads[${i}] has ${words.length} words, needs exactly ${TIMING.tokens}.\n` +
            `One word per click — any other count desynchronises the whole cycle.`,
        );
      }

      const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
      if (longest.length > 14) {
        throw new Error(
          `stage.payloads[${i}] contains "${longest}" (${longest.length} chars).\n` +
            `Max 14 — a longer word overflows the screen face on its own line.`,
        );
      }

      const px = payloadWidth(words);
      if (px > TEXT_BUDGET_PX) {
        throw new Error(
          `stage.payloads[${i}] needs ~${Math.round(px)}px of chip width, budget is ` +
            `${Math.round(TEXT_BUDGET_PX)}px (${Math.round((px / TEXT_BUDGET_PX) * 100)}%).\n` +
            `Shorten the words — same 30-word count, fewer characters.`,
        );
      }
    });
  }

  return scene;
}

/** Human-readable utilisation, so an author can see how close to the edges they are. */
export function describeBudgets(scene: Scene): string[] {
  if (scene.stage.kind !== 'splitCompare') return [];
  return scene.stage.payloads.map((p, i) => {
    const words = p.trim().split(/\s+/);
    const pct = Math.round((payloadWidth(words) / TEXT_BUDGET_PX) * 100);
    const chars = words.join('').length;
    return `payload ${i}: ${words.length} words, ${chars} chars, ${pct}% of screen budget`;
  });
}
