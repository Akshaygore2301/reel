/**
 * What every archetype's timeline shares: the frame rate, the easing helpers,
 * the cycle clock and the contract the rest of the engine reads.
 *
 * Each archetype owns ONE timeline module (`src/archetypes/<kind>/timeline.ts`).
 * Its React component (via `stateAt`) and the offline audio builder (via
 * `buildBeats`) both read that module and nothing else for timing, so sound and
 * picture line up by construction. Different archetypes have different
 * rhythms; within one archetype there is exactly one clock.
 *
 * ---------------------------------------------------------------------------
 * CONSTRAINT: timeline modules must stay importable by bare Node via
 * `--experimental-strip-types`, because `scripts/` loads them. So: no React,
 * relative imports only with an explicit `.ts` extension, `import type` for
 * types, and type-only annotations (no enum, no namespace).
 * ---------------------------------------------------------------------------
 */

export const FPS = 30;

/** Frames over which the payoff layer fades out at the very end. */
export const TAIL_FADE = 10;

export type BeatKind = 'tick' | 'thud' | 'whoosh' | 'accent' | 'riser' | 'stinger';

export type Beat = {
  /** Absolute frame in the finished video. May be negative if trimmed off the head. */
  frame: number;
  kind: BeatKind;
  /** 0..1, pre-normalised. The synth applies its own per-kind level on top. */
  gain: number;
  /** Which cycle this beat belongs to. 0-indexed. */
  cycle: number;
  /** For ticks: which unit (1-based) this click marks. */
  token?: number;
};

/** The fields shared chrome (Footer, StatDelta) needs from any archetype. */
export type BaseState = {
  cycle: number;
  /** 0-indexed cycle-local frame. */
  local: number;
  /** True on the final cycle (and its trailing sliver), which shows stat and credits. */
  isPayoffCycle: boolean;
  /** 0..1 for the comparison panel. */
  statReveal: number;
  /** 0..1 for the credits, revealed on the payoff beat together with the stinger. */
  payoffProgress: number;
  /**
   * 1 until the last few frames, then 0. Everything that exists only on the
   * payoff cycle multiplies by this, so the video ends on the same bare stage it
   * opened on and the platform's loop is invisible.
   */
  tailFade: number;
};

/**
 * The contract every archetype's timeline implements. An archetype builds one
 * per stage (see `timeline` in src/archetypes/registry.ts), because some
 * rhythms depend on content: a pipeline's handoffs land where its stage
 * weights put them.
 */
export type Timeline<S extends BaseState = BaseState> = {
  cycles: number;
  durationInFrames: number;
  /** Names captions may anchor to with `{cycle, on}`. */
  events: readonly string[];
  /** Absolute frame of a named event in a cycle. */
  eventFrame(cycle: number, name: string): number;
  /** Ticks in a cycle. `{cycle, token: n}` caption anchors land on the nth. */
  unitCount(cycle: number): number;
  /** Absolute frame of the nth (1-based) tick of a cycle. */
  unitFrame(cycle: number, n: number): number;
  /** Every sound event in the finished video, sorted by frame. */
  buildBeats(): Beat[];
  stateAt(frame: number): S;
};

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smooth 0..1 over [from, to]. Cubic ease-out: quick to move, soft to land. */
export const ramp = (x: number, from: number, to: number) => {
  const t = clamp01((x - from) / (to - from));
  return 1 - Math.pow(1 - t, 3);
};

/** Smooth 0..1 over [from, to]. Cubic ease-in-out, for things that travel. */
export const glide = (x: number, from: number, to: number) => {
  const t = clamp01((x - from) / (to - from));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * The cycle clock. A reel is `cycles` cycles long and opens `startOffset`
 * frames into the first one, so it also runs `startOffset` frames into a
 * further cycle at the end. That trailing sliver is what makes it loop.
 */
export function makeClock(cfg: { cycle: number; cycles: number; startOffset: number }) {
  const durationInFrames = cfg.cycle * cfg.cycles;

  return {
    durationInFrames,

    /** Absolute frame -> cycle-local frame, accounting for the offset start. */
    localFrame(frame: number): { cycle: number; local: number } {
      const abs = frame + cfg.startOffset;
      const cycle = Math.floor(abs / cfg.cycle);
      return { cycle, local: abs - cycle * cfg.cycle };
    },

    /** Cycle-local frame -> absolute frame. */
    absFrame(cycle: number, local: number): number {
      return cycle * cfg.cycle + local - cfg.startOffset;
    },

    /** See `BaseState.tailFade`. */
    tailFade(frame: number): number {
      return clamp01((durationInFrames - 1 - frame) / TAIL_FADE);
    },
  };
}

/**
 * Per-tick loudness, shared by every archetype so the click bed has the same
 * character across the series. Measured off the reference reel: 45-55 on a
 * 12-tick repeating pattern, accented on the 5th and 9th. That 1.2s phrase is
 * what stops the click bed sounding like a metronome. Loudest tick is 1.0.
 */
const TICK_GAIN_PHRASE = [
  0.87, 0.84, 0.82, 0.87, 1.0, 0.85, 0.84, 0.85, 0.96, 0.89, 0.84, 0.89,
];

/** Emission fades in over its first 3 ticks, as the reference does (27->29->33->53). */
const TICK_RAMP = [0.51, 0.55, 0.62];

/** Gain for the kth (0-based) tick of a run of clicks. */
export const tickGain = (k: number) =>
  TICK_GAIN_PHRASE[k % TICK_GAIN_PHRASE.length] * (k < TICK_RAMP.length ? TICK_RAMP[k] : 1);
