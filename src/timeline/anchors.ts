import type { Timeline } from './core.ts';
import type { Caption, CaptionAnchor } from '../schema/scene.ts';

/**
 * Resolve a semantic caption anchor to an absolute frame.
 *
 * Authors write "on tick 10 of cycle 0" or "when the buffer dumps", never a
 * frame number, so retiming an archetype's cycle moves the captions with it.
 * Anchors are checked against the archetype in SceneSchema, so an unknown event
 * cannot reach here.
 */
export function resolveAnchor(timeline: Timeline, anchor: CaptionAnchor): number {
  if ('token' in anchor) return timeline.unitFrame(anchor.cycle, anchor.token);
  return timeline.eventFrame(anchor.cycle, anchor.on);
}

export type ActiveCaption = { text: string; enteredAt: number; index: number } | null;

/** The caption showing at `frame`: the last one whose anchor has passed. */
export function captionAt(timeline: Timeline, captions: Caption[], frame: number): ActiveCaption {
  let best: ActiveCaption = null;
  captions.forEach((c, index) => {
    const at = resolveAnchor(timeline, c.at);
    if (at <= frame && (best === null || at >= best.enteredAt)) {
      best = { text: c.text, enteredAt: at, index };
    }
  });
  return best;
}
