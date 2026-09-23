/**
 * fanOut's clock. `FanOut.tsx` reads `stateAt`, the audio builder reads
 * `buildBeats`. Node-safe; see the constraint in src/timeline/core.ts.
 *
 * Both lanes start together at frame 0 of every cycle and share one clock.
 * The rhythm depends on content: the top lane's handoffs land where the
 * weights put them, and the join lands when the slowest call returns.
 *
 *   0-90   the clock ticks every 100ms while the sequential lane runs.
 *          100 weight = 90 frames = 30 ticks.
 *   join   the slowest parallel call returns. Bright accent. From here on the
 *          ticks drop in level: only the sequential lane is still waiting.
 *   90     the sequential lane finishes. Whoosh.
 *   110    payoff. Stinger and credits on the last cycle.
 *   130    reset sweep. 147 frames = 4.9s per cycle.
 */
import {
  makeClock,
  ramp,
  tickGain,
  type BaseState,
  type Beat,
  type Timeline,
} from '../../timeline/core.ts';
import type { FanOut } from './schema.ts';

/** 100ms at 30fps. One clock step, one click. */
export const TICK_STRIDE = 3;

export const TIMING = {
  /** Frames the sequential lane takes end to end. */
  sweep: 90,
  payoff: 110,
  reset: 130,
  /** 147 frames = 4.9s. Its own rhythm, not pipeline's 4.8s. */
  cycle: 147,
  cycles: 2,
  startOffset: 12,
} as const;

const FRAMES_PER_WEIGHT = TIMING.sweep / 100;
const frameOf = (weight: number) => Math.round(weight * FRAMES_PER_WEIGHT);

/** Snap a weight to the 100ms grid, so every handoff and the join land ON a tick. */
const snap = (weight: number) =>
  (Math.round((weight * FRAMES_PER_WEIGHT) / TICK_STRIDE) * TICK_STRIDE) / FRAMES_PER_WEIGHT;

const clock = makeClock(TIMING);

export type Span = { start: number; end: number };

export type Layout = {
  /** The calls end to end, tick-snapped. */
  seq: Span[];
  /** Every call from 0, tick-snapped. */
  par: Span[];
  /** Tick-snapped end of the slowest call: the join. */
  join: number;
  /** The authored slowest weight, for the number the fast clock finally shows. */
  exactJoin: number;
  slowest: number;
};

export type FanOutState = BaseState & {
  layout: Layout;
  /** Weight units elapsed this cycle, 0..100. */
  progress: number;
  /** Index of the call the sequential lane is waiting on, or -1 once done. */
  seqActive: number;
  seqDone: number;
  parDone: number;
  joined: boolean;
  done: boolean;
  /** What each clock shows, in weight units, stepping on the 100ms grid. */
  seqClock: number;
  parClock: number;
  sinceTick: number;
  /** Frames since the sequential lane last moved on to its next call. 99 before the first. */
  sinceHandoff: number;
  /** Frames since the join. Negative before. */
  sinceJoin: number;
  resetProgress: number;
};

export function makeLayout(stage: FanOut): Layout {
  const seq: Span[] = [];
  let at = 0;
  for (const c of stage.calls) {
    seq.push({ start: snap(at), end: snap(at + c.weight) });
    at += c.weight;
  }
  const par = stage.calls.map((c) => ({ start: 0, end: snap(c.weight) }));
  const slowest = stage.calls.reduce((best, c, i) => (c.weight > stage.calls[best].weight ? i : best), 0);
  return { seq, par, join: par[slowest].end, exactJoin: stage.calls[slowest].weight, slowest };
}

const EVENTS = ['join', 'done', 'payoff', 'reset'] as const;

const cache = new WeakMap<FanOut, Timeline<FanOutState>>();

/** Pure in `stage`, and cached on it, like pipeline's. */
export function fanOutTimeline(stage: FanOut): Timeline<FanOutState> {
  const hit = cache.get(stage);
  if (hit) return hit;

  const layout = makeLayout(stage);
  const joinAt = frameOf(layout.join);
  const doneAt = TIMING.sweep;
  const ticks = doneAt / TICK_STRIDE;
  const handoffs = layout.seq.slice(1).map((s) => frameOf(s.start));

  function buildBeats(): Beat[] {
    const beats: Beat[] = [];
    const lastCycle = TIMING.cycles - 1;

    // One cycle past the nominal count, for the trailing sliver.
    for (let cycle = 0; cycle <= TIMING.cycles; cycle++) {
      for (let k = 0; k < ticks; k++) {
        const f = k * TICK_STRIDE;
        // Louder on a sequential handoff; quieter once the fan-out has joined,
        // because from then on the only thing happening is waiting.
        const handoff = handoffs.some((h) => Math.abs(h - f) <= 1);
        const g = f > joinAt ? 0.62 : handoff ? 1.12 : 1;
        beats.push({
          frame: clock.absFrame(cycle, f),
          kind: 'tick',
          gain: Math.min(1, tickGain(k) * g),
          cycle,
          token: k + 1,
        });
      }
      beats.push({ frame: clock.absFrame(cycle, joinAt), kind: 'accent', gain: 0.62, cycle });
      beats.push({ frame: clock.absFrame(cycle, doneAt), kind: 'whoosh', gain: 0.74, cycle });
      if (cycle === lastCycle) {
        beats.push({ frame: clock.absFrame(cycle, TIMING.payoff), kind: 'stinger', gain: 1.0, cycle });
      }
      beats.push({ frame: clock.absFrame(cycle, TIMING.reset), kind: 'riser', gain: 0.39, cycle });
    }

    return beats.sort((a, b) => a.frame - b.frame);
  }

  function stateAt(frame: number): FanOutState {
    const { cycle, local } = clock.localFrame(frame);
    const isPayoffCycle = cycle >= TIMING.cycles - 1;
    const pastPayoff = cycle > TIMING.cycles - 1;
    const tailFade = clock.tailFade(frame);

    const done = local >= doneAt;
    const joined = local >= joinAt;
    const progress = Math.min(100, local / FRAMES_PER_WEIGHT);
    const stepped = (Math.floor(local / TICK_STRIDE) * TICK_STRIDE) / FRAMES_PER_WEIGHT;

    const crossed = handoffs.filter((f) => f <= local);

    return {
      cycle,
      local,
      isPayoffCycle,
      layout,
      progress,
      seqActive: done ? -1 : layout.seq.findIndex((s) => progress < s.end),
      seqDone: layout.seq.filter((s) => frameOf(s.end) <= local).length,
      parDone: layout.par.filter((s) => frameOf(s.end) <= local).length,
      joined,
      done,
      seqClock: done ? 100 : Math.min(100, stepped),
      parClock: joined ? layout.exactJoin : Math.min(layout.exactJoin, stepped),
      sinceTick: done ? 99 : local % TICK_STRIDE,
      sinceHandoff: crossed.length > 0 ? local - crossed[crossed.length - 1] : 99,
      sinceJoin: local - joinAt,
      resetProgress: local < TIMING.reset ? 0 : ramp(local, TIMING.reset, TIMING.cycle),
      statReveal: (pastPayoff ? 1 : isPayoffCycle ? ramp(local, 0, 10) : 0) * tailFade,
      payoffProgress:
        (pastPayoff ? 1 : isPayoffCycle ? ramp(local, TIMING.payoff, TIMING.payoff + 6) : 0) *
        tailFade,
      tailFade,
    };
  }

  const eventLocal: Record<(typeof EVENTS)[number], number> = {
    join: joinAt,
    done: doneAt,
    payoff: TIMING.payoff,
    reset: TIMING.reset,
  };

  const timeline: Timeline<FanOutState> = {
    cycles: TIMING.cycles,
    durationInFrames: clock.durationInFrames,
    events: EVENTS,
    eventFrame: (cycle, name) => clock.absFrame(cycle, eventLocal[name as (typeof EVENTS)[number]]),
    unitCount: () => ticks,
    unitFrame: (cycle, n) => clock.absFrame(cycle, (n - 1) * TICK_STRIDE),
    buildBeats,
    stateAt,
  };
  cache.set(stage, timeline);
  return timeline;
}
