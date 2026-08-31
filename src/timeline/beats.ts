/**
 * THE SINGLE SOURCE OF TRUTH FOR TIME.
 *
 * Both the React renderer (via `stateAt`) and the offline audio synthesiser
 * (via `buildBeats`) read this module and nothing else for timing. That is what
 * makes sound and picture line up by construction instead of by nudging.
 *
 * RULE: no component may derive an animation from `useCurrentFrame()` on its
 * own. Ask `stateAt(frame)` instead. The moment two places compute time
 * independently, they drift, and the reel loses the machine-tight feel that is
 * the whole point of the format.
 *
 * ---------------------------------------------------------------------------
 * CONSTRAINT: this file must stay importable by bare Node via
 * `--experimental-strip-types`, because `scripts/build-audio.mjs` loads it.
 * So: zero imports, and type-only annotations (no enum, no namespace).
 * ---------------------------------------------------------------------------
 *
 * Structure measured from the reference reel by RMS-envelope analysis of its
 * audio track plus frame-by-frame inspection:
 *
 *   - a click every 100ms (3 frames) — one per token emitted
 *   - 30 tokens per cycle == 3.0s of emission, matching its "3.0s vs 0.1s" claim
 *   - a low unlock thud, then a 280ms whoosh as the buffer dumps
 *   - a quiet window while nothing is being emitted
 *   - a rising sweep to reset
 *   - period 4.600s exactly, played twice
 */

export const FPS = 30;

/** 100ms at 30fps. One token, one click. */
export const TICK_STRIDE = 3;

export const TIMING = {
  /** Tokens emitted per cycle. 30 x 100ms = the 3.0s figure the reel is about. */
  tokens: 30,

  /** Cycle-local frame of each structural event. Emission occupies [0, 90). */
  emitStart: 0,
  /** Buffer unlock — a low thud. */
  unlock: 93,
  /** Buffer dumps everything at once — the whoosh. */
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
export const DURATION_IN_FRAMES = TIMING.cycle * TIMING.cycles; // 276

/**
 * Per-tick loudness. The reference's clicks are not flat — they measure 45-55
 * on a 12-tick repeating pattern, accented on the 5th and 9th. That 1.2s phrase
 * is what stops the click bed sounding like a metronome.
 * Normalised so the loudest tick is 1.0.
 */
const TICK_GAIN_PHRASE = [
  0.87, 0.84, 0.82, 0.87, 1.0, 0.85, 0.84, 0.85, 0.96, 0.89, 0.84, 0.89,
];

/** Emission fades in over its first 3 ticks, as the reference does (27→29→33→53). */
const TICK_RAMP = [0.51, 0.55, 0.62];

export type BeatKind = 'tick' | 'thud' | 'whoosh' | 'accent' | 'riser' | 'stinger';

export type Beat = {
  /** Absolute frame in the finished video. May be negative if trimmed off the head. */
  frame: number;
  kind: BeatKind;
  /** 0..1, pre-normalised. The synth applies its own per-kind level on top. */
  gain: number;
  /** Which cycle this beat belongs to. 0-indexed. */
  cycle: number;
  /** For ticks: which token (1-based) this click emits. */
  token?: number;
};

/** Absolute frame -> cycle-local frame, accounting for the mid-emission start. */
export function localFrame(frame: number): { cycle: number; local: number } {
  const abs = frame + TIMING.startOffset;
  const cycle = Math.floor(abs / TIMING.cycle);
  const local = abs - cycle * TIMING.cycle;
  return { cycle, local };
}

/** Cycle-local frame -> absolute frame. */
export function absFrame(cycle: number, local: number): number {
  return cycle * TIMING.cycle + local - TIMING.startOffset;
}

/**
 * Every sound event in the finished video, in order.
 *
 * Beats before frame 0 are still emitted (the reel starts mid-phrase, so the
 * first few ticks of cycle 0 are off the head of the file); the audio builder
 * discards anything that lands outside the render window.
 */
export function buildBeats(): Beat[] {
  const beats: Beat[] = [];
  const lastCycle = TIMING.cycles - 1;

  /*
   * Iterate ONE cycle past the nominal count. Because the reel starts
   * `startOffset` frames into emission, its tail runs that far into a further
   * cycle — and `stateAt` duly shows tokens arriving there. Without beats for that
   * sliver the picture emits units in silence for the last 0.4s, which is exactly
   * the kind of drift this module exists to prevent. The audio builder discards
   * whatever lands past the end of the render window.
   */
  for (let cycle = 0; cycle <= TIMING.cycles; cycle++) {
    const isTail = cycle > lastCycle;

    // --- emission: one click per token, on a 100ms grid ---
    for (let k = 0; k < TIMING.tokens; k++) {
      const phrase = TICK_GAIN_PHRASE[k % TICK_GAIN_PHRASE.length];
      const ramp = k < TICK_RAMP.length ? TICK_RAMP[k] : 1;
      beats.push({
        frame: absFrame(cycle, TIMING.emitStart + k * TICK_STRIDE),
        kind: 'tick',
        gain: phrase * ramp,
        cycle,
        token: k + 1,
      });
    }

    // The tail cycle only ever shows its opening emission, so it gets clicks and
    // nothing else. Emitting its dump or payoff would place sounds past the end.
    if (isTail) continue;

    beats.push({ frame: absFrame(cycle, TIMING.unlock), kind: 'thud', gain: 0.58, cycle });
    beats.push({ frame: absFrame(cycle, TIMING.dump), kind: 'whoosh', gain: 0.86, cycle });

    // The last cycle is the payoff, not a repeat: it gets the stinger and the
    // credits reveal. Earlier cycles just get a soft accent.
    beats.push({
      frame: absFrame(cycle, TIMING.payoff),
      kind: cycle === lastCycle ? 'stinger' : 'accent',
      gain: cycle === lastCycle ? 1.0 : 0.62,
      cycle,
    });

    // Every cycle resets, including the last — `stateAt` runs the reset ramp there
    // too, and a visible sweep with no sound is a hole in the mix.
    beats.push({ frame: absFrame(cycle, TIMING.reset), kind: 'riser', gain: 0.39, cycle });
  }

  return beats.sort((a, b) => a.frame - b.frame);
}

/** Which narrative phase the stage is in at a given cycle-local frame. */
export type Phase = 'emitting' | 'held' | 'dumping' | 'settled' | 'resetting';

export type CycleState = {
  cycle: number;
  /** 0-indexed cycle-local frame. */
  local: number;
  /** True on the final cycle, which shows the stat panel and credits. */
  isPayoffCycle: boolean;
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
  /**
   * 0..1 for the comparison panel. Fades in over the OPENING of the payoff
   * cycle, not at the payoff beat — the viewer needs the numbers on screen well
   * before the conclusion lands, or the conclusion has nothing to land on.
   */
  statReveal: number;
  /** 0..1 for the credits, revealed ON the payoff beat together with the stinger. */
  payoffProgress: number;

  /** Frames since the most recent tick, for per-click flashes. */
  sinceTick: number;
  /** Frames since the dump whoosh started. Negative before it. */
  sinceDump: number;
  /**
   * 1 until the last few frames, then 0. Everything that exists only on the
   * payoff cycle multiplies by this, so the video ends on the same bare stage it
   * opened on and the platform's loop is invisible.
   */
  tailFade: number;
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smooth 0..1 over [from, to]. Cubic ease-out — quick to move, soft to land. */
const ramp = (x: number, from: number, to: number) => {
  const t = clamp01((x - from) / (to - from));
  return 1 - Math.pow(1 - t, 3);
};

/** Frames over which the payoff layer fades out at the very end. */
export const TAIL_FADE = 10;

export function stateAt(frame: number): CycleState {
  const { cycle, local } = localFrame(frame);

  /*
   * The video spans `cycles` full cycles measured from frame 0, which — because
   * it starts mid-emission — runs `startOffset` frames into a further cycle. That
   * trailing sliver is what makes the token count loop seamlessly, but it must
   * still be treated as the payoff cycle or the credits blink out at the end.
   */
  const isPayoffCycle = cycle >= TIMING.cycles - 1;
  const pastPayoff = cycle > TIMING.cycles - 1;

  const tailFade = clamp01((DURATION_IN_FRAMES - 1 - frame) / TAIL_FADE);

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
  const waitSeconds = Math.round((fastTokens * TICK_STRIDE) / FPS * 10) / 10;

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
    statReveal: (pastPayoff ? 1 : isPayoffCycle ? ramp(local, 0, 10) : 0) * tailFade,
    payoffProgress:
      (pastPayoff ? 1 : isPayoffCycle ? ramp(local, TIMING.payoff, TIMING.payoff + 6) : 0) *
      tailFade,
    sinceTick: emitting ? local % TICK_STRIDE : 99,
    sinceDump: local - TIMING.dump,
    tailFade,
  };
}
