import React from 'react';
import { FONT } from '../../brand/fonts';
import { COLOR, MONO_FEATURES, TRACK, VIDEO, withAlpha } from '../../brand/tokens';
import { COUNTER, SOURCE_LABEL, STAT, mirrorX } from '../../primitives/geometry';
import { Counter } from '../../primitives/Counter';
import { LabelBlock, TitleBlock } from '../../primitives/Labels';
import { Machine } from '../../primitives/Machine';
import { Server } from '../../primitives/Server';
import { StatDelta } from '../../primitives/StatDelta';
import { Rivet, Wire } from '../../primitives/Wire';
import { useTimelineState } from '../../timeline/context';
import type { ScaleOut as ScaleOutStage } from './schema';
import { TICK_STRIDE, TIMING, scaleOutTimeline } from './timeline';

type Pt = { x: number; y: number };

/**
 * Stage geometry, 720x1280. The shared source sits where splitCompare's machine
 * does, so the series still reads as one family. Below it the two sides are
 * deliberately NOT mirror images: one box on the left, a router and a row of
 * boxes on the right. The asymmetry is the argument.
 */
const G = {
  /** Where a request leaves the source for each side. */
  upPort: { x: 285, y: 572 },
  outPort: { x: 435, y: 572 },

  /** The one box. Grows in place around its centre. */
  up: { cx: 150, cy: 716, w: 104, h: 104, wBig: 150, hBig: 136 },
  /** Where requests wait while the box is down: two rows above it. */
  queue: { x: 110, y: 606, cols: 8, pitch: 10, chip: 7 },

  router: { cx: 570, y: 598, w: 104, h: 26 },
  /** Out nodes: one centred, then two side by side. All the same size as the small box. */
  node: { cy: 716, w: 104, h: 104, soloCx: 570, pairCx: [512, 628] as const, slide: 34 },

  unitY: 780,
  titleY: 880,
} as const;

/** Frames a request takes from the source to a box. */
const TRAVEL = 9;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Point at t along a polyline, by equal share per segment. */
function along(pts: Pt[], t: number): Pt {
  const segs = pts.length - 1;
  const i = Math.min(segs - 1, Math.floor(t * segs));
  const u = t * segs - i;
  return { x: lerp(pts[i].x, pts[i + 1].x, u), y: lerp(pts[i].y, pts[i + 1].y, u) };
}

const pathOf = (pts: Pt[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

/**
 * One source, two ways to add capacity: make the box bigger, or add a box.
 *
 * Every animated value below is derived from the scaleOut timeline's
 * `stateAt`. Nothing here keeps its own clock.
 */
export const ScaleOut: React.FC<{ stage: ScaleOutStage }> = ({ stage }) => {
  const s = useTimelineState(scaleOutTimeline);

  const fade = 1 - s.resetProgress;
  const tickFlash = Math.max(0, 1 - s.sinceTick / 2);

  // ---- up side ----
  const upW = lerp(G.up.w, G.up.wBig, s.growProgress);
  const upH = lerp(G.up.h, G.up.hBig, s.growProgress);
  const upTop = G.up.cy - upH / 2;
  const upPath: Pt[] = [G.upPort, { x: G.up.cx, y: 600 }, { x: G.up.cx, y: upTop }];

  // ---- out side ----
  const k = s.spawnProgress;
  const nodeA = lerp(G.node.soloCx, G.node.pairCx[0], k);
  const nodeB = G.node.pairCx[1] + (1 - k) * G.node.slide;
  const nodeTop = G.node.cy - G.node.h / 2;
  const routerBot = { x: G.router.cx, y: G.router.y + G.router.h };
  const outIn: Pt[] = [G.outPort, { x: G.router.cx, y: G.router.y }];

  // Requests in flight. Request j left the source at local j*TICK_STRIDE.
  const flying: { j: number; t: number }[] = [];
  for (let j = 0; j < TIMING.requests; j++) {
    const t = (s.local - j * TICK_STRIDE) / TRAVEL;
    if (t >= 0 && t <= 1) flying.push({ j, t });
  }
  const arrivedAt = (j: number) => j * TICK_STRIDE;
  const downAt = (j: number) => arrivedAt(j) >= TIMING.offline && arrivedAt(j) < TIMING.online;
  const splitAt = (j: number) => arrivedAt(j) >= TIMING.spawn;

  // The queue while the box is down, then the same chips dropping into it.
  const drained = (TIMING.online - TIMING.offline) / TICK_STRIDE;
  const chips = s.upOffline ? s.queued : s.drainProgress > 0 && s.drainProgress < 1 ? drained : 0;
  const drop = s.upOffline ? 0 : s.drainProgress;

  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      <svg
        width={VIDEO.width}
        height={VIDEO.height}
        viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Machine
          color={COLOR.machine}
          emitted={s.arrived}
          sinceTick={s.sinceTick}
          lcdText={`REQ ${s.arrived}`}
          lcdDim={s.sinceTick === 99 ? 0.45 : 1}
          lcdFont={FONT.mono}
        />

        {/* ---- up: one wire into one box ---- */}
        <Wire d={pathOf(upPath)} color={COLOR.slow} w={1.4} glow={2} opacity={s.upOffline ? 0.4 : 0.8} />
        <Server
          cx={G.up.cx}
          cy={G.up.cy}
          w={upW}
          h={upH}
          color={COLOR.slow}
          load={s.upLoad}
          offline={s.upOffline}
          flash={s.upOffline ? 0 : tickFlash}
        />

        {chips > 0 &&
          Array.from({ length: chips }, (_, i) => {
            const col = i % G.queue.cols;
            const row = Math.floor(i / G.queue.cols);
            const x = G.queue.x + col * G.queue.pitch;
            const y = G.queue.y + row * G.queue.pitch;
            // Drain: every chip falls into the box's top edge at once.
            const tx = lerp(x, G.up.cx - G.queue.chip / 2, drop);
            const ty = lerp(y, upTop + 6, drop);
            return (
              <rect
                key={i}
                x={tx}
                y={ty}
                width={G.queue.chip}
                height={G.queue.chip}
                fill={withAlpha(COLOR.slow, 0.85 * (1 - drop))}
                stroke={COLOR.slow}
                strokeWidth={1}
                opacity={1 - drop * 0.8}
              />
            );
          })}

        {/* ---- out: router, then the nodes ---- */}
        <Wire d={pathOf(outIn)} color={COLOR.fast} w={1.4} glow={2} opacity={0.8} />
        <Wire
          d={`M${G.router.cx - G.router.w / 2},${G.router.y} h${G.router.w} v${G.router.h} h${-G.router.w} Z`}
          color={COLOR.fast}
          w={1.8}
          glow={3}
        />
        <Wire d={pathOf([routerBot, { x: nodeA, y: nodeTop }])} color={COLOR.fast} w={1.2} glow={0} opacity={0.7} />
        {k > 0 && (
          <Wire
            d={pathOf([routerBot, { x: nodeB, y: nodeTop }])}
            color={COLOR.fast}
            w={1.2}
            glow={0}
            opacity={0.7 * k}
          />
        )}
        <Server
          cx={nodeA}
          cy={G.node.cy}
          w={G.node.w}
          h={G.node.h}
          color={COLOR.fast}
          load={s.outLoad}
          flash={tickFlash}
        />
        {k > 0 && (
          <Server
            cx={nodeB}
            cy={G.node.cy}
            w={G.node.w}
            h={G.node.h}
            color={COLOR.fast}
            load={s.outLoad}
            flash={tickFlash}
            opacity={k}
          />
        )}

        {/* ---- requests in flight ---- */}
        {flying.map(({ j, t }) => {
          // Up: stops at the door while the box is down; it joins the queue.
          const upT = downAt(j) ? Math.min(t, 0.5) : t;
          const up = along(upPath, upT);
          // Out: to the router, then alternating between nodes once there are two.
          const target = splitAt(j) && j % 2 === 1 ? nodeB : nodeA;
          const out = along([...outIn, routerBot, { x: target, y: nodeTop }], t);
          const hide = downAt(j) && t > 0.5;
          return (
            <g key={j}>
              {!hide && <Rivet cx={up.x} cy={up.y} r={2.6} color={COLOR.slow} />}
              <Rivet cx={out.x} cy={out.y} r={2.6} color={COLOR.fast} />
            </g>
          );
        })}
      </svg>

      <LabelBlock
        cx={SOURCE_LABEL.cx}
        y={SOURCE_LABEL.y}
        label={stage.source.label}
        sub={stage.source.sub}
        color={COLOR.machine}
      />

      {/* ---- counters ---- */}
      <Counter
        cx={COUNTER.leftCx}
        y={COUNTER.y}
        label={stage.counterLabel}
        value={s.upServed}
        color={COLOR.slow}
        // The drained queue lands on the counter all at once: flash on the jump.
        flash={s.upOffline ? 0 : s.drainProgress > 0 ? Math.max(tickFlash, 1 - s.drainProgress) : tickFlash}
        align="left"
      />
      <Counter
        cx={mirrorX(COUNTER.leftCx)}
        y={COUNTER.y}
        label={stage.counterLabel}
        value={s.outServed}
        color={COLOR.fast}
        flash={tickFlash}
        align="right"
      />

      {/* Router name, inside its box. */}
      <Tag cx={G.router.cx} y={G.router.y + 7} text={stage.out.router} color={COLOR.fast} />

      {/* ---- the up box while it is down ---- */}
      {s.upOffline && (
        <OfflineBadge
          cx={G.up.cx}
          cy={G.up.cy}
          label={stage.up.offlineLabel}
          progress={s.offlineProgress}
          step={s.arrived}
        />
      )}

      {/* ---- sizes and load under each box ---- */}
      <UnitLine
        cx={G.up.cx}
        y={G.unitY + (G.up.hBig - G.up.h) / 2 * s.growProgress}
        unit={s.growProgress > 0.5 ? stage.up.unitAfter : stage.up.unit}
        load={s.upOffline ? 'DOWN' : pct(s.upLoad)}
        color={COLOR.slow}
      />
      <UnitLine cx={nodeA} y={G.unitY} unit={stage.out.unit} load={pct(s.outLoad)} color={COLOR.fast} />
      {k > 0 && (
        <>
          <UnitLine cx={nodeB} y={G.unitY} unit={stage.out.unit} load={pct(s.outLoad)} color={COLOR.fast} opacity={k} />
          <Tag cx={nodeB + 26} y={nodeTop - 18} text={stage.out.spawnLabel} color={COLOR.fast} opacity={k} />
        </>
      )}

      <StatDelta stat={stage.stat} reveal={s.statReveal} box={STAT} />

      <TitleBlock cx={G.up.cx} y={G.titleY} title={stage.up.title} sub={stage.up.sub} color={COLOR.slow} />
      <TitleBlock cx={G.router.cx} y={G.titleY} title={stage.out.title} sub={stage.out.sub} color={COLOR.fast} />
    </div>
  );
};

const Tag: React.FC<{ cx: number; y: number; text: string; color: string; opacity?: number }> = ({
  cx,
  y,
  text,
  color,
  opacity = 1,
}) => (
  <div
    style={{
      position: 'absolute',
      left: cx - 60,
      top: y,
      width: 120,
      textAlign: 'center',
      fontFamily: FONT.mono,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: TRACK.wide - 0.8,
      color,
      opacity,
      whiteSpace: 'nowrap',
      ...MONO_FEATURES,
    }}
  >
    {text.toUpperCase()}
  </div>
);

const UnitLine: React.FC<{
  cx: number;
  y: number;
  unit: string;
  load: string;
  color: string;
  opacity?: number;
}> = ({ cx, y, unit, load, color, opacity = 1 }) => (
  <div
    style={{
      position: 'absolute',
      left: cx - 70,
      top: y,
      width: 140,
      textAlign: 'center',
      fontFamily: FONT.mono,
      fontSize: 10,
      fontWeight: 500,
      color: COLOR.inkDim,
      opacity,
      whiteSpace: 'nowrap',
      ...MONO_FEATURES,
    }}
  >
    <span style={{ color }}>{unit.toUpperCase()}</span>
    <span style={{ color: COLOR.inkFaint }}>{' · '}</span>
    {load}
  </div>
);

/**
 * The up box's face while it is being resized: a stepping spinner, what is
 * happening, and how far along it is. No seconds on purpose: real resizes take
 * minutes, and a clock counting 1.6s would undercut the header's claim.
 */
const OfflineBadge: React.FC<{ cx: number; cy: number; label: string; progress: number; step: number }> = ({
  cx,
  cy,
  label,
  progress,
  step,
}) => {
  const r = 11;
  return (
    <div style={{ position: 'absolute', left: cx - 50, top: cy - 30, width: 100, textAlign: 'center' }}>
      <svg width={100} height={28} viewBox="0 0 100 28" style={{ display: 'block' }}>
        <g transform={`rotate(${step * 30} 50 14)`}>
          <circle cx={50} cy={14} r={r} fill="none" stroke={withAlpha(COLOR.slow, 0.2)} strokeWidth={2.4} />
          <circle
            cx={50}
            cy={14}
            r={r}
            fill="none"
            stroke={COLOR.slow}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * r * 0.72} ${2 * Math.PI * r}`}
          />
        </g>
      </svg>
      <div
        style={{
          marginTop: 4,
          fontFamily: FONT.sans,
          fontSize: 12,
          fontWeight: 600,
          color: COLOR.slow,
        }}
      >
        {label}
      </div>
      <div
        style={{
          margin: '6px auto 0',
          width: 64,
          height: 4,
          border: `1px solid ${withAlpha(COLOR.slow, 0.5)}`,
        }}
      >
        <div style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: COLOR.slow }} />
      </div>
    </div>
  );
};
