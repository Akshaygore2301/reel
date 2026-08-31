import { TICK_STRIDE, TIMING, absFrame } from './beats';
import type { Caption, CaptionAnchorSchema } from '../schema/scene';
import type { z } from 'zod';

type Anchor = z.infer<typeof CaptionAnchorSchema>;

/**
 * Resolve a semantic caption anchor to an absolute frame.
 *
 * Authors write "on token 10 of cycle 0" or "when the buffer dumps", never a
 * frame number — so retiming the cycle in beats.ts moves the captions with it.
 */
export function resolveAnchor(anchor: Anchor): number {
  if ('token' in anchor) {
    return absFrame(anchor.cycle, (anchor.token - 1) * TICK_STRIDE);
  }
  const local =
    anchor.on === 'dump' ? TIMING.dump : anchor.on === 'payoff' ? TIMING.payoff : TIMING.reset;
  return absFrame(anchor.cycle, local);
}

export type ActiveCaption = { text: string; enteredAt: number; index: number } | null;

/** The caption showing at `frame`: the last one whose anchor has passed. */
export function captionAt(captions: Caption[], frame: number): ActiveCaption {
  let best: ActiveCaption = null;
  captions.forEach((c, index) => {
    const at = resolveAnchor(c.at);
    if (at <= frame && (best === null || at >= best.enteredAt)) {
      best = { text: c.text, enteredAt: at, index };
    }
  });
  return best;
}
