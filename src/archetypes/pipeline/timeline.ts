/**
 * pipeline's clock. `Pipeline.tsx` reads `stateAt`, the audio builder reads
 * `buildBeats`. Node-safe; see the constraint in src/timeline/core.ts.
 *
 * Unlike splitCompare, the rhythm depends on content: one request walks the
 * stages, the clock ticks every 100ms while it does, and the handoffs land
 * where the stage weights put them. You hear the bottleneck: a thud as the
 * request enters it, the clock ticking quietly while nothing else happens, a
 * whoosh when it finally gets out.
 *
 *   cycle 0   the path as it is. 100 weight = 90 frames = 30 ticks.
 *   cycle 1   the same path with the bottleneck fixed. Shorter sweep, fewer
 *             ticks, the clock stops early. Stat and credits land here.
 */
import {
  makeClock,
  ramp,
  tickGain,
  type BaseState,
  type Beat,
  type Timeline,
} from '../../timeline/core.ts';
import type { Pipeline } from './schema.ts';

/** 100ms at 30fps. One clock step, one click. */
export const TICK_STRIDE = 3;

export const TIMING = {
  /** Frames the unfixed path takes end to end. 100 weight = 3.0s on screen. */
  sweep: 90,
  /** Stinger and credits on the last cycle. */
  payoff: 110,
  /** Reset sweep. Everything fades back to an empty waterfall after this. */
  reset: 130,
  /** 144 frames = 4.800s. Deliberately not splitCompare's 4.6s. */
  cycle: 144,
  cycles: 2,
  /** Opens a few ticks into the first request, so the stage is never empty. */
  startOffset: 12,
} as const;

const FRAMES_PER_WEIGHT = TIMING.sweep / 100;

/** Weight -> cycle-local frame. */
const frameOf = (weight: number) => Math.round(weight * FRAMES_PER_WEIGHT);

/**
 * Nearest weight whose frame is on the 100ms tick grid. Stage boundaries are
 * snapped to it so every handoff (and its thud or whoosh) lands ON a tick
 * rather than a frame beside one. At most 1.7 weight units of drift, invisible
 * at 422px, and never zero width: weights are >= 4, i.e. 1.2 ticks apart.
 */
const snap = (weight: number) =>
  (Math.round((weight * FRAMES_PER_WEIGHT) / TICK_STRIDE) * TICK_STRIDE) / FRAMES_PER_WEIGHT;

const clock = makeClock(TIMING);

/** A stage's extent along the waterfall, in weight units (the unfixed total is 100). */
export type Span = { start: number; end: number };

export type Layout = {
  /** True on the cycle that runs the fixed path. */
  fixed: boolean;
  /** Tick-snapped extents. Everything animated reads these. */
  spans: Span[];
  /** Tick-snapped end of the last stage. */
  total: number;
  /** The authored total (100 unfixed), for the numbers the clock finally shows. */
  exactTotal: number;
  bottleneck: number;
};

export type PipelineState = BaseState & {
  layout: Layout;
  /** Weight units the request has covered this cycle, 0..layout.total. */
  progress: number;
  /** Index of the stage the request is in, or -1 once it is done. */
  active: number;
  stagesDone: number;
  /** What the clock shows, in weight units, stepping on the 100ms grid. */
  clockWeight: number;
  done: boolean;
  /** Frames since the request came out the far end. Negative before. */
  sinceDone: number;
  /** Frames since the most recent tick, for per-click flashes. 99 when idle. */
  sinceTick: number;
  /** Frames since the request last crossed into a new stage. 99 before the first. */
  sinceHandoff: number;
  /** 0..1 ramp for the reset sweep. */
  resetProgress: number;
};

function makeLayout(stage: Pipeline, fixed: boolean): Layout {
  const bottleneck = stage.stages.findIndex((s) => s.bottleneck);
  const spans: Span[] = [];
  let at = 0;
  stage.stages.forEach((s, i) => {
    const w = fixed && i === bottleneck ? stage.fix.weight : s.weight;
    spans.push({ start: snap(at), end: snap(at + w) });
    at += w;
  });
  return { fixed, spans, total: spans[spans.length - 1].end, exactTotal: at, bottleneck };
}

const EVENTS = ['bottleneck', 'done', 'payoff', 'reset'] as const;

const cache = new WeakMap<Pipeline, Timeline<PipelineState>>();

/**
 * Pure in `stage`, and cached on it, so Reel, the component and the audio
 * builder all see the same instance for the same scene.
 */
export function pipelineTimeline(stage: Pipeline): Timeline<PipelineState> {
  const hit = cache.get(stage);
  if (hit) return hit;

  const before = makeLayout(stage, false);
  const after = makeLayout(stage, true);

  // Only the last real cycle runs the fix. The trailing sliver past it is the
  // start of a fresh unfixed run, which is what the video's first frame shows.
  const layoutOf = (cycle: number) => (cycle === TIMING.cycles - 1 ? after : before);
  const doneAt = (cycle: number) => frameOf(layoutOf(cycle).total);
  const unitCount = (cycle: number) => Math.ceil(doneAt(cycle) / TICK_STRIDE);

  function buildBeats(): Beat[] {
    const beats: Beat[] = [];
    const lastCycle = TIMING.cycles - 1;

    // One cycle past the nominal count, for the trailing sliver; the audio
    // builder drops whatever lands past the end.
    for (let cycle = 0; cycle <= TIMING.cycles; cycle++) {
      const L = layoutOf(cycle);
      const b = L.spans[L.bottleneck];
      const bStart = frameOf(b.start);
      const bEnd = frameOf(b.end);
      const handoffs = L.spans.slice(1).map((s) => frameOf(s.start));

      // The clock: one click per 100ms while the request is in flight. Inside
      // the bottleneck it ticks quietly, because nothing else is happening.
      for (let k = 0; k < unitCount(cycle); k++) {
        const f = k * TICK_STRIDE;
        const inBottleneck = f > bStart && f < bEnd;
        // The tick nearest each ordinary handoff lands a little harder.
        const handoff = handoffs.some((h) => h !== bStart && h !== bEnd && Math.abs(h - f) <= 1);
        const g = inBottleneck ? 0.6 : handoff ? 1.12 : 1;
        beats.push({
          frame: clock.absFrame(cycle, f),
          kind: 'tick',
          gain: Math.min(1, tickGain(k) * g),
          cycle,
          token: k + 1,
        });
      }

      beats.push({ frame: clock.absFrame(cycle, bStart), kind: 'thud', gain: 0.58, cycle });
      beats.push({ frame: clock.absFrame(cycle, bEnd), kind: 'whoosh', gain: 0.74, cycle });
      beats.push({ frame: clock.absFrame(cycle, doneAt(cycle)), kind: 'accent', gain: 0.62, cycle });

      if (cycle === lastCycle) {
        beats.push({ frame: clock.absFrame(cycle, TIMING.payoff), kind: 'stinger', gain: 1.0, cycle });
      }
      beats.push({ frame: clock.absFrame(cycle, TIMING.reset), kind: 'riser', gain: 0.39, cycle });
    }

    return beats.sort((a, b) => a.frame - b.frame);
  }

  function stateAt(frame: number): PipelineState {
    const { cycle, local } = clock.localFrame(frame);
    const layout = layoutOf(cycle);
    const isPayoffCycle = cycle >= TIMING.cycles - 1;
    const pastPayoff = cycle > TIMING.cycles - 1;
    const tailFade = clock.tailFade(frame);

    const end = doneAt(cycle);
    const done = local >= end;
    const progress = Math.min(layout.total, local / FRAMES_PER_WEIGHT);

    const active = done ? -1 : layout.spans.findIndex((s) => progress < s.end);
    const stagesDone = layout.spans.filter((s) => frameOf(s.end) <= local).length;

    // The clock steps with the ticks and lands exactly on the total when done.
    const clockWeight = done
      ? layout.exactTotal
      : Math.min(
          layout.exactTotal,
          (Math.floor(local / TICK_STRIDE) * TICK_STRIDE) / FRAMES_PER_WEIGHT,
        );

    const crossed = layout.spans
      .slice(1)
      .map((s) => frameOf(s.start))
      .filter((f) => f <= local);
    const sinceHandoff = crossed.length > 0 ? local - crossed[crossed.length - 1] : 99;

    return {
      cycle,
      local,
      isPayoffCycle,
      layout,
      progress,
      active,
      stagesDone,
      clockWeight,
      done,
      sinceDone: local - end,
      sinceTick: done ? 99 : local % TICK_STRIDE,
      sinceHandoff,
      resetProgress: local < TIMING.reset ? 0 : ramp(local, TIMING.reset, TIMING.cycle),
      statReveal: (pastPayoff ? 1 : isPayoffCycle ? ramp(local, 0, 10) : 0) * tailFade,
      payoffProgress:
        (pastPayoff ? 1 : isPayoffCycle ? ramp(local, TIMING.payoff, TIMING.payoff + 6) : 0) *
        tailFade,
      tailFade,
    };
  }

  const eventLocal = (cycle: number, name: string) => {
    const L = layoutOf(cycle);
    switch (name as (typeof EVENTS)[number]) {
      case 'bottleneck':
        return frameOf(L.spans[L.bottleneck].start);
      case 'done':
        return doneAt(cycle);
      case 'payoff':
        return TIMING.payoff;
      case 'reset':
        return TIMING.reset;
    }
  };

  const timeline: Timeline<PipelineState> = {
    cycles: TIMING.cycles,
    durationInFrames: clock.durationInFrames,
    events: EVENTS,
    eventFrame: (cycle, name) => clock.absFrame(cycle, eventLocal(cycle, name)),
    unitCount,
    unitFrame: (cycle, n) => clock.absFrame(cycle, (n - 1) * TICK_STRIDE),
    buildBeats,
    stateAt,
  };
  cache.set(stage, timeline);
  return timeline;
}
