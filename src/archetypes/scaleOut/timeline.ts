/**
 * scaleOut's clock. `ScaleOut.tsx` reads `stateAt`, the audio builder reads
 * `buildBeats`. Node-safe; see the constraint in src/timeline/core.ts.
 *
 * Content-independent: every scaleOut reel shares this rhythm.
 *
 *   0-102   a request every 100ms (35 clicks). Load climbs on both sides.
 *   36      both sides hit capacity.
 *   39      out: a second node spins up behind the router. Bright accent.
 *   45      up: the one box goes down to be resized. Low thud. Requests that
 *           arrive now pile up in a queue.
 *   93      up: the bigger box comes back and drains the queue. Whoosh.
 *   105     traffic stops, load falls back.
 *   117     payoff. Stinger and credits on the last cycle.
 *   138     reset sweep. 150 frames = 5.0s per cycle.
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

/** 100ms at 30fps. One request, one click. */
export const TICK_STRIDE = 3;

export const TIMING = {
  requests: 35,
  saturate: 36,
  spawn: 39,
  offline: 45,
  online: 93,
  payoff: 117,
  reset: 138,
  cycle: 150,
  cycles: 2,
  /** Opens on request 5, mid-traffic, like every reel in the series. */
  startOffset: 12,
} as const;

const TRAFFIC_END = TIMING.requests * TICK_STRIDE; // 105

/** How much bigger the up side comes back, as a divisor on its load. */
export const GROWTH = 4;

const clock = makeClock(TIMING);

export type ScaleOutState = BaseState & {
  /** Requests that have arrived this cycle, 0..requests. */
  arrived: number;
  upServed: number;
  outServed: number;
  /** Requests waiting for the up side while it is down. */
  queued: number;
  upOffline: boolean;
  /** 0..1 across the offline window, for its progress bar. */
  offlineProgress: number;
  /** 0..1 as the up box grows back, larger. */
  growProgress: number;
  /** 0..1 as the queue empties into the returned box. */
  drainProgress: number;
  /** 0..1 as the out side's second node slides in. */
  spawnProgress: number;
  /** 0..1 utilisation of the up box. 0 while it is down. */
  upLoad: number;
  /** 0..1 utilisation of each out node. */
  outLoad: number;
  /** Frames since the most recent arrival, for per-click flashes. 99 when idle. */
  sinceTick: number;
  resetProgress: number;
};

/** Demand as a share of ONE small box: climbs to full at `saturate`, eases off after traffic stops. */
function demand(local: number): number {
  const rising = 0.4 + 0.6 * clamp01(local / TIMING.saturate);
  return rising * (1 - 0.85 * ramp(local, TRAFFIC_END, TIMING.payoff));
}

function buildBeats(): Beat[] {
  const beats: Beat[] = [];
  const lastCycle = TIMING.cycles - 1;

  // One cycle past the nominal count, for the trailing sliver; the audio builder
  // drops whatever lands past the end.
  for (let cycle = 0; cycle <= TIMING.cycles; cycle++) {
    for (let k = 0; k < TIMING.requests; k++) {
      beats.push({
        frame: clock.absFrame(cycle, k * TICK_STRIDE),
        kind: 'tick',
        gain: tickGain(k),
        cycle,
        token: k + 1,
      });
    }
    beats.push({ frame: clock.absFrame(cycle, TIMING.spawn), kind: 'accent', gain: 0.62, cycle });
    beats.push({ frame: clock.absFrame(cycle, TIMING.offline), kind: 'thud', gain: 0.58, cycle });
    beats.push({ frame: clock.absFrame(cycle, TIMING.online), kind: 'whoosh', gain: 0.86, cycle });
    if (cycle === lastCycle) {
      beats.push({ frame: clock.absFrame(cycle, TIMING.payoff), kind: 'stinger', gain: 1.0, cycle });
    }
    beats.push({ frame: clock.absFrame(cycle, TIMING.reset), kind: 'riser', gain: 0.39, cycle });
  }

  return beats.sort((a, b) => a.frame - b.frame);
}

function stateAt(frame: number): ScaleOutState {
  const { cycle, local } = clock.localFrame(frame);
  const isPayoffCycle = cycle >= TIMING.cycles - 1;
  const pastPayoff = cycle > TIMING.cycles - 1;
  const tailFade = clock.tailFade(frame);

  const inTraffic = local < TRAFFIC_END;
  const arrived = inTraffic ? Math.floor(local / TICK_STRIDE) + 1 : TIMING.requests;

  // Requests that arrived before the box went down were served; the one landing
  // on the offline beat itself is the first to queue.
  const beforeOffline = TIMING.offline / TICK_STRIDE;
  const upOffline = local >= TIMING.offline && local < TIMING.online;
  const back = local >= TIMING.online;
  const upServed = upOffline ? beforeOffline : arrived;
  const queued = upOffline ? arrived - beforeOffline : 0;

  const spawnProgress = ramp(local, TIMING.spawn, TIMING.spawn + 10);
  const growProgress = ramp(local, TIMING.online, TIMING.online + 8);
  const d = demand(local);

  return {
    cycle,
    local,
    isPayoffCycle,
    arrived,
    upServed,
    outServed: arrived,
    queued,
    upOffline,
    offlineProgress: clamp01((local - TIMING.offline) / (TIMING.online - TIMING.offline)),
    growProgress,
    drainProgress: ramp(local, TIMING.online, TIMING.online + 9),
    spawnProgress,
    upLoad: upOffline ? 0 : Math.min(1, back ? d / (1 + (GROWTH - 1) * growProgress) : d),
    outLoad: Math.min(1, d / (1 + spawnProgress)),
    sinceTick: inTraffic ? local % TICK_STRIDE : 99,
    resetProgress: local < TIMING.reset ? 0 : ramp(local, TIMING.reset, TIMING.cycle),
    statReveal: (pastPayoff ? 1 : isPayoffCycle ? ramp(local, 0, 10) : 0) * tailFade,
    payoffProgress:
      (pastPayoff ? 1 : isPayoffCycle ? ramp(local, TIMING.payoff, TIMING.payoff + 6) : 0) *
      tailFade,
    tailFade,
  };
}

const EVENTS = ['saturate', 'spawn', 'offline', 'online', 'payoff', 'reset'] as const;

export const scaleOutTimeline: Timeline<ScaleOutState> = {
  cycles: TIMING.cycles,
  durationInFrames: clock.durationInFrames,
  events: EVENTS,
  eventFrame: (cycle, name) => clock.absFrame(cycle, TIMING[name as (typeof EVENTS)[number]]),
  unitCount: () => TIMING.requests,
  unitFrame: (cycle, n) => clock.absFrame(cycle, (n - 1) * TICK_STRIDE),
  buildBeats,
  stateAt,
};
