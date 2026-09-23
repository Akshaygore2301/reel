/**
 * lifecycle's clock. `Lifecycle.tsx` reads `stateAt`, the audio builder reads
 * `buildBeats`. Node-safe; see the constraint in src/timeline/core.ts.
 *
 * A request arrives every 300ms (9 frames), ten per cycle, against a pool of
 * six. Each one takes a slot and walks the states: 6 frames down into the
 * first, 6 in each, 6 back up to the pool.
 *
 *   cycle 0   leaking. Every resource parks in the stuck state. The seventh
 *             request finds the pool empty: a low thud, and it and every one
 *             after it waits. Quieter knocks for those.
 *   cycle 1   fixed. Every resource returns: a small chime as its slot frees.
 *             At most five are ever out, so the pool never empties.
 *
 *   payoff 129, reset 141, 156 frames = 5.2s per cycle.
 */
import {
  clamp01,
  makeClock,
  ramp,
  tickGain,
  type BaseState,
  type Beat,
  type Timeline,
} from '../../timeline/core.ts';
import type { Lifecycle } from './schema.ts';

export const POOL_SIZE = 6;
export const REQUESTS = 10;

/** 300ms: one request, one click. On the series' 100ms grid, every third tick. */
export const ARRIVAL_STRIDE = 9;

export const TIMING = {
  /** Frames from the pool down into the first state, and back up from the last. */
  leg: 6,
  /** Frames per state: 3 sitting, 3 moving on. */
  perState: 6,
  /** Frames to slide into the stuck pile. */
  park: 3,
  payoff: 129,
  reset: 141,
  cycle: 156,
  cycles: 2,
  startOffset: 12,
} as const;

const clock = makeClock(TIMING);

export const arrivalAt = (j: number) => j * ARRIVAL_STRIDE;

/** One pooled resource in flight. */
export type Token = {
  /** Pool slot it came from (and returns to). */
  slot: number;
  /**
   * Where it is on the loop: 0 at its pool slot, 1..m at state 0..m-1, m+1
   * back at the pool. Continuous while moving.
   */
  p: number;
  /** 0..1 as it slides into the stuck pile, leaking cycle only. */
  park: number;
  /** Its place in the stuck pile. */
  pile: number;
};

export type LifecycleState = BaseState & {
  leaking: boolean;
  tokens: Token[];
  /** Pool slots free right now, as a set of slot indices. */
  free: boolean[];
  /** Requests blocked on an empty pool. */
  waiting: number;
  /** Requests that have arrived this cycle. */
  arrived: number;
  /** Frames since the last arrival. 99 after traffic. */
  sinceArrival: number;
  /** Frames since the most recent release. 99 before the first. */
  sinceRelease: number;
  /** Frames since the pool ran dry. Negative before, and on the fixed cycle. */
  sinceExhausted: number;
  resetProgress: number;
};

const EVENTS = ['stuck', 'exhausted', 'release', 'payoff', 'reset'] as const;

type Plan = {
  /** For each request: the slot it got and when, or null if it blocked. */
  grants: ({ slot: number; at: number } | null)[];
  releases: { slot: number; at: number }[];
};

const cache = new WeakMap<Lifecycle, Timeline<LifecycleState>>();

/** Pure in `stage`, and cached on it. */
export function lifecycleTimeline(stage: Lifecycle): Timeline<LifecycleState> {
  const hit = cache.get(stage);
  if (hit) return hit;

  const m = stage.states.length;
  const k = stage.stuckState;
  const life = TIMING.leg * 2 + TIMING.perState * m;
  const stuckAt = TIMING.leg + TIMING.perState * k;
  const exhaustedAt = arrivalAt(POOL_SIZE);

  /** Simulate the pool. Releases at a frame free their slot before that frame's arrival. */
  function plan(leaking: boolean): Plan {
    const busyUntil: number[] = Array(POOL_SIZE).fill(-1);
    const grants: Plan['grants'] = [];
    const releases: Plan['releases'] = [];
    for (let j = 0; j < REQUESTS; j++) {
      const at = arrivalAt(j);
      const slot = busyUntil.findIndex((u) => u !== Infinity && u <= at);
      if (slot < 0) {
        grants.push(null);
        continue;
      }
      grants.push({ slot, at });
      busyUntil[slot] = leaking ? Infinity : at + life;
      if (!leaking) releases.push({ slot, at: at + life });
    }
    return { grants, releases };
  }
  const plans = [plan(true), plan(false)];
  const leakingOn = (cycle: number) => cycle !== TIMING.cycles - 1;
  const planOf = (cycle: number) => (leakingOn(cycle) ? plans[0] : plans[1]);

  /** Loop position of a token granted at `at`, at cycle-local `local`. */
  function positionOf(at: number, local: number, leaking: boolean): { p: number; park: number } {
    const dt = local - at;
    if (dt < TIMING.leg) return { p: dt / TIMING.leg, park: 0 };
    if (leaking && dt >= stuckAt) return { p: 1 + k, park: clamp01((dt - stuckAt) / TIMING.park) };
    const inStates = dt - TIMING.leg;
    const i = Math.floor(inStates / TIMING.perState);
    if (i >= m - 1) {
      // The last state sits its whole beat, then climbs back to the pool.
      const intoLast = inStates - TIMING.perState * (m - 1);
      if (intoLast < TIMING.perState) return { p: m, park: 0 };
      return { p: m + Math.min(1, (intoLast - TIMING.perState) / TIMING.leg), park: 0 };
    }
    const into = inStates - TIMING.perState * i;
    const sit = TIMING.perState / 2;
    return { p: 1 + i + (into < sit ? 0 : (into - sit) / sit), park: 0 };
  }

  function buildBeats(): Beat[] {
    const beats: Beat[] = [];
    const lastCycle = TIMING.cycles - 1;
    for (let cycle = 0; cycle <= TIMING.cycles; cycle++) {
      const P = planOf(cycle);
      P.grants.forEach((g, j) => {
        beats.push({
          frame: clock.absFrame(cycle, arrivalAt(j)),
          kind: 'tick',
          gain: tickGain(j) * (g ? 1 : 0.62),
          cycle,
          token: j + 1,
        });
      });
      if (leakingOn(cycle)) {
        beats.push({ frame: clock.absFrame(cycle, exhaustedAt), kind: 'thud', gain: 0.58, cycle });
      }
      for (const r of P.releases) {
        beats.push({ frame: clock.absFrame(cycle, r.at), kind: 'accent', gain: 0.4, cycle });
      }
      if (cycle === lastCycle) {
        beats.push({ frame: clock.absFrame(cycle, TIMING.payoff), kind: 'stinger', gain: 1.0, cycle });
      }
      beats.push({ frame: clock.absFrame(cycle, TIMING.reset), kind: 'riser', gain: 0.39, cycle });
    }
    return beats.sort((a, b) => a.frame - b.frame);
  }

  function stateAt(frame: number): LifecycleState {
    const { cycle, local } = clock.localFrame(frame);
    const isPayoffCycle = cycle >= TIMING.cycles - 1;
    const pastPayoff = cycle > TIMING.cycles - 1;
    const tailFade = clock.tailFade(frame);
    const leaking = leakingOn(cycle);
    const P = planOf(cycle);

    const tokens: Token[] = [];
    let pile = 0;
    P.grants.forEach((g) => {
      if (!g || local < g.at) return;
      if (!leaking && local >= g.at + life) return;
      const pos = positionOf(g.at, local, leaking);
      tokens.push({ slot: g.slot, ...pos, pile: pos.park > 0 ? pile++ : 0 });
    });

    const free = Array.from({ length: POOL_SIZE }, (_, slot) => !tokens.some((t) => t.slot === slot));
    const arrived = Math.min(REQUESTS, Math.floor(local / ARRIVAL_STRIDE) + 1);
    const lastArrival = arrivalAt(REQUESTS - 1);
    const released = P.releases.filter((r) => r.at <= local);

    return {
      cycle,
      local,
      isPayoffCycle,
      leaking,
      tokens,
      free,
      waiting: P.grants.filter((g, j) => g === null && arrivalAt(j) <= local).length,
      arrived,
      sinceArrival: local > lastArrival + ARRIVAL_STRIDE ? 99 : local % ARRIVAL_STRIDE,
      sinceRelease: released.length ? local - released[released.length - 1].at : 99,
      sinceExhausted: leaking ? local - exhaustedAt : -1,
      resetProgress: local < TIMING.reset ? 0 : ramp(local, TIMING.reset, TIMING.cycle),
      statReveal: (pastPayoff ? 1 : isPayoffCycle ? ramp(local, 0, 10) : 0) * tailFade,
      payoffProgress:
        (pastPayoff ? 1 : isPayoffCycle ? ramp(local, TIMING.payoff, TIMING.payoff + 6) : 0) * tailFade,
      tailFade,
    };
  }

  // Events land at the same local frame on both cycles, so a caption on the
  // fixed cycle can point at the moment the leaking one went wrong.
  const eventLocal: Record<(typeof EVENTS)[number], number> = {
    stuck: stuckAt,
    exhausted: exhaustedAt,
    release: life,
    payoff: TIMING.payoff,
    reset: TIMING.reset,
  };

  const timeline: Timeline<LifecycleState> = {
    cycles: TIMING.cycles,
    durationInFrames: clock.durationInFrames,
    events: EVENTS,
    eventFrame: (cycle, name) => clock.absFrame(cycle, eventLocal[name as (typeof EVENTS)[number]]),
    unitCount: () => REQUESTS,
    unitFrame: (cycle, n) => clock.absFrame(cycle, arrivalAt(n - 1)),
    buildBeats,
    stateAt,
  };
  cache.set(stage, timeline);
  return timeline;
}
