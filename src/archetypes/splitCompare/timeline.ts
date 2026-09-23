/**
 * splitCompare's clock. The single source of truth for time in this archetype:
 * `SplitCompare.tsx` reads `stateAt`, the audio builder reads `buildBeats`.
 * Node-safe; see the constraint in src/timeline/core.ts.
 *
 * Structure measured from the reference reel by RMS-envelope analysis of its
 * audio track plus frame-by-frame inspection:
 *
 *   - a click every 100ms (3 frames), one per token emitted
 *   - 30 tokens per cycle == 3.0s of emission, matching its "3.0s vs 0.1s" claim
 *   - a low unlock thud, then a 280ms whoosh as the buffer dumps
 *   - a quiet window while nothing is being emitted
 *   - a rising sweep to reset
 *   - period 4.600s exactly, played twice
 */
import {
  FPS,
  makeClock,
  ramp,
  tickGain,
  type BaseState,
  type Beat,
  type Timeline,
} from '../../timeline/core.ts';

/** 100ms at 30fps. One token, one click. */
export const TICK_STRIDE = 3;

export const TIMING = {
  /** Tokens emitted per cycle. 30 x 100ms = the 3.0s figure the reel is about. */
  tokens: 30,

  /** Cycle-local frame of each structural event. Emission occupies [0, 90). */
  emitStart: 0,
  /** Buffer unlock, a low thud. */
  unlock: 93,
  /** Buffer dumps everything at once, the whoosh. */
  dump: 95,
  /** The point being made lands. Accent in cycle 0, stinger in the last cycle. */
  payoff: 113,
  /** Reset sweep. Everything returns to its opening state after this. */
  reset: 132,

  /** Total cycle length. 138 frames = 4.600s. */
  cycle: 138,
  cycles: 2,

  /**
   * The reel opens mid-emission, on token 5, exactly as the reference does.
   * Starting cold on an empty stage wastes the first half second of a format
   * where the first half second decides whether anyone keeps watching.
   */
  startOffset: 12,
} as const;

export const EMIT_FRAMES = TIMING.tokens * TICK_STRIDE; // 90

const clock = makeClock(TIMING);

/** Which narrative phase the stage is in at a given cycle-local frame. */
export type Phase = 'emitting' | 'held' | 'dumping' | 'settled' | 'resetting';

export type SplitCompareState = BaseState & {
  phase: Phase;

  /** Tokens the streaming (fast) side has revealed: 0..tokens. */
  fastTokens: number;
  /** Tokens the buffered (slow) side has revealed. 0 until the dump, then all. */
  slowTokens: number;
  /** Tokens sitting in the buffer, unread. */
  buffered: number;

  /** Seconds the slow side has been waiting, quantised to 0.1s like the reference. */
  waitSeconds: number;

  /** 0..1 ramp for the buffer-dump animation. */
  dumpProgress: number;
  /** 0..1 ramp for the reset sweep. 0 outside the reset window. */
  resetProgress: number;

  /** Frames since the most recent tick, for per-click flashes. */
  sinceTick: number;
  /** Frames since the dump whoosh started. Negative before it. */
  sinceDump: number;
};

/**
 * Every sound event in the finished video, in order.
 *
 * Beats before frame 0 are still emitted (the reel starts mid-phrase, so the
 * first few ticks of cycle 0 are off the head of the file); the audio builder
 * discards anything that lands outside the render window.
 */
function buildBeats(): Beat[] {
  const beats: Beat[] = [];
  const lastCycle = TIMING.cycles - 1;

  /*
   * Iterate ONE cycle past the nominal count. Because the reel starts
   * `startOffset` frames into emission, its tail runs that far into a further
   * cycle, and `stateAt` duly shows tokens arriving there. Without beats for that
   * sliver the picture emits units in silence for the last 0.4s, which is exactly
   * the kind of drift this module exists to prevent. The audio builder discards
   * whatever lands past the end of the render window.
   */
  for (let cycle = 0; cycle <= TIMING.cycles; cycle++) {
    const isTail = cycle > lastCycle;

    // --- emission: one click per token, on a 100ms grid ---
    for (let k = 0; k < TIMING.tokens; k++) {
      beats.push({
        frame: clock.absFrame(cycle, TIMING.emitStart + k * TICK_STRIDE),
        kind: 'tick',
        gain: tickGain(k),
        cycle,
        token: k + 1,
      });
    }

    // The tail cycle only ever shows its opening emission, so it gets clicks and
    // nothing else. Emitting its dump or payoff would place sounds past the end.
    if (isTail) continue;

    beats.push({ frame: clock.absFrame(cycle, TIMING.unlock), kind: 'thud', gain: 0.58, cycle });
    beats.push({ frame: clock.absFrame(cycle, TIMING.dump), kind: 'whoosh', gain: 0.86, cycle });

    // The last cycle is the payoff, not a repeat: it gets the stinger and the
    // credits reveal. Earlier cycles just get a soft accent.
    beats.push({
      frame: clock.absFrame(cycle, TIMING.payoff),
      kind: cycle === lastCycle ? 'stinger' : 'accent',
      gain: cycle === lastCycle ? 1.0 : 0.62,
      cycle,
    });

    // Every cycle resets, including the last: `stateAt` runs the reset ramp there
    // too, and a visible sweep with no sound is a hole in the mix.
    beats.push({ frame: clock.absFrame(cycle, TIMING.reset), kind: 'riser', gain: 0.39, cycle });
  }

  return beats.sort((a, b) => a.frame - b.frame);
}

function stateAt(frame: number): SplitCompareState {
  const { cycle, local } = clock.localFrame(frame);

  /*
   * The video spans `cycles` full cycles measured from frame 0, which, because
   * it starts mid-emission, runs `startOffset` frames into a further cycle. That
   * trailing sliver is what makes the token count loop seamlessly, but it must
   * still be treated as the payoff cycle or the credits blink out at the end.
   */
  const isPayoffCycle = cycle >= TIMING.cycles - 1;
  const pastPayoff = cycle > TIMING.cycles - 1;

  const tailFade = clock.tailFade(frame);

  const emitting = local < EMIT_FRAMES;
  const fastTokens = emitting
    ? Math.min(TIMING.tokens, Math.floor(local / TICK_STRIDE) + 1)
    : TIMING.tokens;

  // The slow side shows nothing at all until the buffer opens, then everything.
  const dumped = local >= TIMING.dump;
  const slowTokens = dumped ? TIMING.tokens : 0;

  let phase: Phase;
  if (local < EMIT_FRAMES) phase = 'emitting';
  else if (local < TIMING.dump) phase = 'held';
  else if (local < TIMING.dump + 9) phase = 'dumping';
  else if (local < TIMING.reset) phase = 'settled';
  else phase = 'resetting';

  // Wait time climbs with emission and freezes at the total once emission ends,
  // because the buffered reply could not have arrived any earlier than the last
  // token. That equality is the reel's actual argument: 3.0s == 3.0s.
  const waitSeconds = Math.round(((fastTokens * TICK_STRIDE) / FPS) * 10) / 10;

  return {
    cycle,
    local,
    isPayoffCycle,
    phase,
    fastTokens,
    slowTokens,
    buffered: dumped ? 0 : fastTokens,
    waitSeconds,
    dumpProgress: ramp(local, TIMING.dump, TIMING.dump + 9),
    resetProgress: local < TIMING.reset ? 0 : ramp(local, TIMING.reset, TIMING.cycle),
    // Fades in over the OPENING of the payoff cycle, not at the payoff beat: the
    // viewer needs the numbers on screen well before the conclusion lands.
    statReveal: (pastPayoff ? 1 : isPayoffCycle ? ramp(local, 0, 10) : 0) * tailFade,
    payoffProgress:
      (pastPayoff ? 1 : isPayoffCycle ? ramp(local, TIMING.payoff, TIMING.payoff + 6) : 0) *
      tailFade,
    sinceTick: emitting ? local % TICK_STRIDE : 99,
    sinceDump: local - TIMING.dump,
    tailFade,
  };
}

const EVENTS = ['dump', 'payoff', 'reset'] as const;

/** Content-independent: every splitCompare reel shares this rhythm. */
export const splitCompareTimeline: Timeline<SplitCompareState> = {
  cycles: TIMING.cycles,
  durationInFrames: clock.durationInFrames,
  events: EVENTS,
  eventFrame: (cycle, name) => clock.absFrame(cycle, TIMING[name as (typeof EVENTS)[number]]),
  unitCount: () => TIMING.tokens,
  unitFrame: (cycle, n) => clock.absFrame(cycle, TIMING.emitStart + (n - 1) * TICK_STRIDE),
  buildBeats,
  stateAt,
};
