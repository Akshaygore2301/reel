/**
 * layers' clock. `Layers.tsx` reads `stateAt`, the audio builder reads
 * `buildBeats`. Node-safe; see the constraint in src/timeline/core.ts.
 *
 * On-screen time is NOT proportional to latency: layers differ by orders of
 * magnitude (a CPU cache vs a disk), so no linear scale could show both. Each
 * layer gets the same beat on screen; the latency clock shows the real sum.
 *
 *   0          the request leaves the top of the spine
 *   9+18i      it arrives at layer i. Harder tick. It asks for 9 frames.
 *   found      the target answers: the origin on the cold cycle (low thud),
 *              `hitLayer` on the warm one (bright accent)
 *   found+3    the answer starts back up the spine, 3 frames a layer. Whoosh.
 *   done       it is back at the top; the clock stops.
 *   120        payoff. Stinger and credits on the last cycle.
 *   136        reset sweep. 153 frames = 5.1s per cycle.
 */
import {
  makeClock,
  ramp,
  tickGain,
  type BaseState,
  type Beat,
  type Timeline,
} from '../../timeline/core.ts';
import type { Layers } from './schema.ts';

/** 100ms at 30fps. One click. */
export const TICK_STRIDE = 3;

export const TIMING = {
  /** Frames from the top to the first layer. */
  enter: 9,
  /** Frames between arriving at one layer and the next. */
  perLayer: 18,
  /** Of those, frames spent asking. */
  ask: 9,
  /** Frames per layer on the way back up. */
  climb: 3,
  payoff: 120,
  reset: 136,
  cycle: 153,
  cycles: 2,
  startOffset: 12,
} as const;

const clock = makeClock(TIMING);

export type LayerStatus = 'idle' | 'asking' | 'miss' | 'found' | 'stored' | 'skipped';

export type LayersState = BaseState & {
  /** The layer that answers this cycle. */
  target: number;
  warm: boolean;
  /** Per layer, what it shows right now. */
  status: LayerStatus[];
  /** Position of the request on the spine, in layer units: -1 at the top, i at layer i. */
  at: number;
  returning: boolean;
  done: boolean;
  /** Layers asked so far. */
  asked: number;
  /** Real latency accrued, in ms, stepping on the 100ms grid. */
  clockMs: number;
  sinceTick: number;
  /** Frames since the request arrived at the layer it is at. 99 when travelling. */
  sinceArrive: number;
  /** Frames since the target answered. Negative before. */
  sinceFound: number;
  resetProgress: number;
};

const EVENTS = ['found', 'done', 'payoff', 'reset'] as const;

const cache = new WeakMap<Layers, Timeline<LayersState>>();

/** Pure in `stage`, and cached on it. */
export function layersTimeline(stage: Layers): Timeline<LayersState> {
  const hit = cache.get(stage);
  if (hit) return hit;

  const n = stage.layers.length;
  const origin = n - 1;
  // Only the last real cycle is warm. The trailing sliver starts a fresh cold
  // run, which is what the first frame shows, so the loop is seamless.
  const targetOf = (cycle: number) => (cycle === TIMING.cycles - 1 ? stage.hitLayer : origin);
  const arriveAt = (i: number) => TIMING.enter + TIMING.perLayer * i;
  const foundAt = (cycle: number) => arriveAt(targetOf(cycle)) + TIMING.ask;
  const doneAt = (cycle: number) => foundAt(cycle) + TIMING.climb * (targetOf(cycle) + 1);
  const unitCount = (cycle: number) => doneAt(cycle) / TICK_STRIDE;

  /** Latency accrued at cycle-local frame `local`, stepped to the tick grid. */
  function clockAt(cycle: number, local: number): number {
    const t = Math.floor(local / TICK_STRIDE) * TICK_STRIDE;
    let ms = 0;
    for (let i = 0; i <= targetOf(cycle); i++) {
      const u = (t - arriveAt(i)) / TIMING.ask;
      if (u <= 0) break;
      ms += stage.layers[i].ms * Math.min(1, u);
    }
    return ms;
  }

  function buildBeats(): Beat[] {
    const beats: Beat[] = [];
    const lastCycle = TIMING.cycles - 1;

    for (let cycle = 0; cycle <= TIMING.cycles; cycle++) {
      const target = targetOf(cycle);
      const arrivals = Array.from({ length: target + 1 }, (_, i) => arriveAt(i));
      for (let k = 0; k < unitCount(cycle); k++) {
        const f = k * TICK_STRIDE;
        const g = arrivals.includes(f) ? 1.12 : f > foundAt(cycle) ? 0.8 : 1;
        beats.push({ frame: clock.absFrame(cycle, f), kind: 'tick', gain: Math.min(1, tickGain(k) * g), cycle, token: k + 1 });
      }
      const found = foundAt(cycle);
      beats.push(
        target === origin
          ? { frame: clock.absFrame(cycle, found), kind: 'thud', gain: 0.58, cycle }
          : { frame: clock.absFrame(cycle, found), kind: 'accent', gain: 0.62, cycle },
      );
      beats.push({ frame: clock.absFrame(cycle, found + TICK_STRIDE), kind: 'whoosh', gain: 0.7, cycle });
      if (cycle === lastCycle) {
        beats.push({ frame: clock.absFrame(cycle, TIMING.payoff), kind: 'stinger', gain: 1.0, cycle });
      }
      beats.push({ frame: clock.absFrame(cycle, TIMING.reset), kind: 'riser', gain: 0.39, cycle });
    }

    return beats.sort((a, b) => a.frame - b.frame);
  }

  function stateAt(frame: number): LayersState {
    const { cycle, local } = clock.localFrame(frame);
    const isPayoffCycle = cycle >= TIMING.cycles - 1;
    const pastPayoff = cycle > TIMING.cycles - 1;
    const tailFade = clock.tailFade(frame);

    const target = targetOf(cycle);
    const warm = target !== origin;
    const found = foundAt(cycle);
    const done = local >= doneAt(cycle);
    const returning = local >= found;

    // Where the request is on the spine.
    let at: number;
    let sinceArrive = 99;
    if (returning) {
      at = target - (local - found) / TIMING.climb;
      at = Math.max(-1, at);
    } else if (local < TIMING.enter) {
      at = -1 + local / TIMING.enter;
    } else {
      const i = Math.min(target, Math.floor((local - TIMING.enter) / TIMING.perLayer));
      const into = local - arriveAt(i);
      sinceArrive = into;
      at = into <= TIMING.ask ? i : i + (into - TIMING.ask) / (TIMING.perLayer - TIMING.ask);
    }

    const status: LayerStatus[] = stage.layers.map((_, i) => {
      if (i > target) return warm ? 'skipped' : 'idle';
      if (local < arriveAt(i)) return warm && i === stage.hitLayer ? 'stored' : 'idle';
      if (i < target) return local < arriveAt(i) + TIMING.ask ? 'asking' : 'miss';
      if (!returning) return 'asking';
      return 'found';
    });
    // Cold cycle: the answer is stored in the cache layer as it passes on the way back up.
    if (!warm && returning && at <= stage.hitLayer) status[stage.hitLayer] = 'stored';

    return {
      cycle,
      local,
      isPayoffCycle,
      target,
      warm,
      status,
      at,
      returning,
      done,
      asked: stage.layers.filter((_, i) => i <= target && local >= arriveAt(i)).length,
      clockMs: done ? stage.layers.slice(0, target + 1).reduce((a, l) => a + l.ms, 0) : clockAt(cycle, local),
      sinceTick: done ? 99 : local % TICK_STRIDE,
      sinceArrive,
      sinceFound: local - found,
      resetProgress: local < TIMING.reset ? 0 : ramp(local, TIMING.reset, TIMING.cycle),
      statReveal: (pastPayoff ? 1 : isPayoffCycle ? ramp(local, 0, 10) : 0) * tailFade,
      payoffProgress:
        (pastPayoff ? 1 : isPayoffCycle ? ramp(local, TIMING.payoff, TIMING.payoff + 6) : 0) * tailFade,
      tailFade,
    };
  }

  const eventLocal = (cycle: number, name: string) => {
    switch (name as (typeof EVENTS)[number]) {
      case 'found':
        return foundAt(cycle);
      case 'done':
        return doneAt(cycle);
      case 'payoff':
        return TIMING.payoff;
      case 'reset':
        return TIMING.reset;
    }
  };

  const timeline: Timeline<LayersState> = {
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
