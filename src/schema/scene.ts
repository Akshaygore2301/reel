import { z } from 'zod';
// Explicit .ts extensions: this module is loaded by bare Node in scripts/, which
// does not do extensionless resolution. Webpack handles it either way.
import { mono } from './fields.ts';
import {
  StageSchema,
  describeStage,
  timelineFor,
  validateStage,
} from '../archetypes/registry.ts';
import { resolveAnchor } from '../timeline/anchors.ts';

/**
 * The contract for a reel. Everything topic-specific lives here; everything
 * visual and temporal lives in code. An authored scene is pure content.
 *
 * The parts every reel shares (header, captions, credits) are defined here. The
 * stage is one of the archetypes in `src/archetypes/registry.ts`, each with its
 * own schema and its own rules.
 *
 * Colour is assigned by the archetype, never by the author. `slow` is always
 * amber, `fast` always mint. See prompts/author-scene.md.
 */

export const CaptionAnchorSchema = z
  .union([
    z.object({
      cycle: z.number().int().min(0),
      token: z.number().int().min(1).describe('The nth tick of the cycle.'),
    }),
    z.object({
      cycle: z.number().int().min(0),
      on: z.string().min(1).describe("A named event of the scene's archetype, e.g. 'dump'."),
    }),
  ])
  .describe('When the caption swaps in. Anchored to a beat, never a raw frame.');

export const CaptionSchema = z.object({
  at: CaptionAnchorSchema,
  text: mono(52).describe('Sentence case, ends with . or ?. This is the line people read.'),
});

export const SceneSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case; becomes the composition id and output filename'),

    handle: z
      .string()
      .startsWith('@')
      .optional()
      .describe('Override for this reel only. Omit it: the default comes from reel.config.json.'),

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
  })
  // Anchors depend on the archetype: its cycle count, ticks per cycle and events.
  .superRefine((scene, ctx) => {
    const t = timelineFor(scene.stage);
    const events = t.events;
    scene.captions.forEach(({ at }, i) => {
      const path = ['captions', i, 'at'];
      if (at.cycle >= t.cycles) {
        ctx.addIssue({ code: 'custom', path, message: `cycle must be 0..${t.cycles - 1}` });
      }
      if ('token' in at && at.cycle < t.cycles && at.token > t.unitCount(at.cycle)) {
        const n = t.unitCount(at.cycle);
        ctx.addIssue({ code: 'custom', path, message: `cycle ${at.cycle} has ticks 1..${n}` });
      }
      const valid =
        at.cycle < t.cycles &&
        ('token' in at ? at.token <= t.unitCount(at.cycle) : events.includes(at.on));
      if (valid && resolveAnchor(t, at) < 0) {
        ctx.addIssue({
          code: 'custom',
          path,
          message: 'lands before the first frame: the reel opens 12 frames into cycle 0. Anchor it later.',
        });
      }
      if ('on' in at && !events.includes(at.on)) {
        ctx.addIssue({
          code: 'custom',
          path,
          message: `"${at.on}" is not an event of ${scene.stage.kind}. Have: ${events.join(', ')}`,
        });
      }
    });
  });

export type Scene = z.infer<typeof SceneSchema>;
export type Caption = z.infer<typeof CaptionSchema>;
export type CaptionAnchor = z.infer<typeof CaptionAnchorSchema>;

/** Parse, then apply the archetype's rules a type cannot express. */
export function validateScene(input: unknown): Scene {
  const scene = SceneSchema.parse(input);
  validateStage(scene.stage);
  return scene;
}

/** Human-readable utilisation, so an author can see how close to the edges they are. */
export function describeBudgets(scene: Scene): string[] {
  return describeStage(scene.stage);
}
