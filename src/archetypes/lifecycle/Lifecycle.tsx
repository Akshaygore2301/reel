import React from 'react';
import { FONT } from '../../brand/fonts';
import { COLOR, MONO_FEATURES, TRACK, TYPE, VIDEO, withAlpha } from '../../brand/tokens';
import { COUNTER, MID, SOURCE_LABEL, mirrorX } from '../../primitives/geometry';
import { Counter } from '../../primitives/Counter';
import { LabelBlock } from '../../primitives/Labels';
import { StatStrip } from '../../primitives/StatStrip';
import { Rivet, Wire } from '../../primitives/Wire';
import { useTimelineState } from '../../timeline/context';
import type { Lifecycle as LifecycleStage } from './schema';
import { POOL_SIZE, lifecycleTimeline, type Token } from './timeline';

type Pt = { x: number; y: number };

/**
 * Stage geometry, 720x1280. A closed loop: the pool at the top centre, a leg
 * down into the first state, the states in a row, a leg back up from the last
 * one into the pool. When the loop is broken the right leg stays dark and the
 * resources pile up in one box.
 */
const G = {
  slot: { y: 506, size: 24, gap: 10 },
  legY: 518,
  waitY: 550,
  box: { top: 604, h: 78, x0: 34, x1: 686, gap: 14 },
  labelY: 694,
  token: 14,
  strip: { x: 34, y: 852, w: 652 },
} as const;

const SLOTS_W = POOL_SIZE * G.slot.size + (POOL_SIZE - 1) * G.slot.gap;
const SLOT_X0 = MID - SLOTS_W / 2;
const slotCx = (i: number) => SLOT_X0 + G.slot.size / 2 + i * (G.slot.size + G.slot.gap);

const rect = (x: number, y: number, w: number, h: number) =>
  `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Point at t along a polyline, by length. */
function along(pts: Pt[], t: number): Pt {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let d = t * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const u = lens[i] === 0 ? 0 : Math.min(1, d / lens[i]);
      return { x: lerp(pts[i].x, pts[i + 1].x, u), y: lerp(pts[i].y, pts[i + 1].y, u) };
    }
    d -= lens[i];
  }
  return pts[pts.length - 1];
}

/**
 * A pooled resource that has to come back.
 *
 * Every animated value below is derived from the lifecycle timeline's
 * `stateAt`. Nothing here keeps its own clock.
 */
export const Lifecycle: React.FC<{ stage: LifecycleStage }> = ({ stage }) => {
  const s = useTimelineState(lifecycleTimeline(stage));
  const m = stage.states.length;
  const k = stage.stuckState;

  const boxW = (G.box.x1 - G.box.x0 - G.box.gap * (m - 1)) / m;
  const boxX = (i: number) => G.box.x0 + i * (boxW + G.box.gap);
  const boxCx = (i: number) => boxX(i) + boxW / 2;
  const boxCy = G.box.top + G.box.h / 2;

  const fade = 1 - s.resetProgress;
  const arrivalFlash = Math.max(0, 1 - s.sinceArrival / 3);
  const releaseFlash = Math.max(0, 1 - s.sinceRelease / 6);
  const dryFlash = s.sinceExhausted >= 0 ? Math.max(0, 1 - s.sinceExhausted / 8) : 0;
  const dry = s.leaking && s.sinceExhausted >= 0;
  const piled = s.tokens.filter((t) => t.park > 0).length;

  const freeCount = s.free.filter(Boolean).length;

  // Where each token is, from its loop position.
  const pileCols = Math.max(1, Math.floor((boxW - 12) / (G.token + 6)));
  const pilePos = (n: number): Pt => ({
    x: boxX(k) + 10 + (n % pileCols) * (G.token + 6) + G.token / 2,
    y: G.box.top + 12 + Math.floor(n / pileCols) * (G.token + 6) + G.token / 2,
  });
  const tokenAt = (t: Token): Pt => {
    const home = { x: slotCx(t.slot), y: G.legY };
    if (t.p <= 1) return along([home, { x: boxCx(0), y: G.legY }, { x: boxCx(0), y: boxCy }], t.p);
    if (t.p >= m) {
      return along([{ x: boxCx(m - 1), y: boxCy }, { x: boxCx(m - 1), y: G.legY }, home], t.p - m);
    }
    const i = Math.floor(t.p) - 1;
    const at = { x: lerp(boxCx(i), boxCx(i + 1), t.p - 1 - i), y: boxCy };
    if (t.park === 0) return at;
    const to = pilePos(t.pile);
    return { x: lerp(at.x, to.x, t.park), y: lerp(at.y, to.y, t.park) };
  };

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      <svg
        width={VIDEO.width}
        height={VIDEO.height}
        viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* ---- the loop ---- */}
        <Wire
          d={`M${SLOT_X0 - 8},${G.legY} L${boxCx(0)},${G.legY} L${boxCx(0)},${G.box.top}`}
          color={COLOR.machine}
          w={1.4}
          glow={2}
          opacity={0.7}
        />
        {/* The way back. Broken while leaking: nothing ever travels it. */}
        <Wire
          d={`M${boxCx(m - 1)},${G.box.top} L${boxCx(m - 1)},${G.legY} L${SLOT_X0 + SLOTS_W + 8},${G.legY}`}
          color={s.leaking ? COLOR.inkFaint : COLOR.fast}
          w={1.4}
          glow={s.leaking ? 0 : 2 + 2 * releaseFlash}
          opacity={s.leaking ? 0.6 : 0.8}
          dash={s.leaking ? '4 5' : undefined}
        />
        {stage.states.slice(0, -1).map((_, i) => (
          <Wire
            key={i}
            d={`M${boxX(i) + boxW},${boxCy} L${boxX(i + 1)},${boxCy} M${boxX(i + 1) - 5},${boxCy - 4} L${boxX(i + 1)},${boxCy} L${boxX(i + 1) - 5},${boxCy + 4}`}
            color={s.leaking && i >= k ? COLOR.inkFaint : COLOR.machine}
            w={1.2}
            glow={0}
            opacity={s.leaking && i >= k ? 0.5 : 0.8}
          />
        ))}

        {/* ---- the pool ---- */}
        <Wire
          d={rect(SLOT_X0 - 8, G.slot.y - 8, SLOTS_W + 16, G.slot.size + 16)}
          color={dry ? COLOR.slow : COLOR.machine}
          w={1.6}
          glow={dry ? 2 + 3 * dryFlash : 2}
        />
        {s.free.map((free, i) => {
          const x = slotCx(i) - G.slot.size / 2;
          return free ? (
            <g key={i}>
              <path d={rect(x, G.slot.y, G.slot.size, G.slot.size)} fill={withAlpha(COLOR.fast, 0.22)} />
              <Wire d={rect(x, G.slot.y, G.slot.size, G.slot.size)} color={COLOR.fast} w={1.4} glow={2} />
            </g>
          ) : (
            <Wire
              key={i}
              d={rect(x, G.slot.y, G.slot.size, G.slot.size)}
              color={COLOR.inkFaint}
              w={1}
              glow={0}
              dash="3 3"
            />
          );
        })}

        {/* ---- requests blocked on an empty pool ---- */}
        {Array.from({ length: s.waiting }, (_, i) => {
          const size = 12;
          const total = s.waiting * size + (s.waiting - 1) * 6;
          const x = MID - total / 2 + i * (size + 6);
          return (
            <Wire
              key={i}
              d={rect(x, G.waitY, size, size)}
              color={COLOR.slow}
              w={1.2}
              glow={i === s.waiting - 1 ? 2 + 2 * arrivalFlash : 1}
              fill={withAlpha(COLOR.slow, 0.18)}
            />
          );
        })}

        {/* ---- states ---- */}
        {stage.states.map((_, i) => {
          const stuckBox = i === k;
          const color = stuckBox ? (s.leaking ? (piled > 0 ? COLOR.slow : COLOR.machine) : COLOR.fast) : COLOR.machine;
          const hot = stuckBox && s.leaking && piled > 0;
          return (
            <g key={i}>
              <path d={rect(boxX(i), G.box.top, boxW, G.box.h)} fill={withAlpha(hot ? COLOR.slow : '#0A1017', hot ? 0.08 : 0.8)} />
              <Wire
                d={rect(boxX(i), G.box.top, boxW, G.box.h)}
                color={color}
                w={stuckBox ? 2 : 1.6}
                glow={stuckBox ? 3 : 1.5}
                opacity={stuckBox ? 1 : 0.75}
              />
            </g>
          );
        })}

        {/* ---- resources ---- */}
        {s.tokens.map((t, i) => {
          const { x, y } = tokenAt(t);
          const color = t.park > 0 ? COLOR.slow : t.p > m ? COLOR.fast : COLOR.ink;
          // Home stretch: it merges into its slot rather than sliding over the others.
          const home = t.p > m + 0.6 ? 1 - (t.p - m - 0.6) / 0.4 : 1;
          return (
            <g key={i} opacity={home}>
              <path
                d={rect(x - G.token / 2, y - G.token / 2, G.token, G.token)}
                fill={withAlpha(color, t.park > 0 ? 0.3 : 0.2)}
              />
              <Wire d={rect(x - G.token / 2, y - G.token / 2, G.token, G.token)} color={color} w={1.4} glow={2} />
            </g>
          );
        })}
        <Rivet cx={SLOT_X0 - 8} cy={G.legY} r={2.4} color={COLOR.machine} />
        <Rivet cx={SLOT_X0 + SLOTS_W + 8} cy={G.legY} r={2.4} color={s.leaking ? COLOR.inkFaint : COLOR.fast} />
      </svg>

      <LabelBlock cx={SOURCE_LABEL.cx} y={SOURCE_LABEL.y} label={stage.pool.label} sub={stage.pool.sub} color={COLOR.machine} />

      {/* ---- counters ---- */}
      <Counter
        cx={COUNTER.leftCx}
        y={COUNTER.y}
        label={stage.freeLabel}
        value={`${freeCount}/${POOL_SIZE}`}
        color={freeCount === 0 ? COLOR.slow : COLOR.fast}
        flash={Math.max(dryFlash, releaseFlash)}
        align="left"
      />
      <Counter
        cx={mirrorX(COUNTER.leftCx)}
        y={COUNTER.y}
        label={stage.waitLabel}
        value={s.waiting}
        color={s.waiting > 0 ? COLOR.slow : COLOR.fast}
        flash={s.waiting > 0 ? arrivalFlash : 0}
        align="right"
      />

      {/* ---- state labels ---- */}
      {stage.states.map((st, i) => {
        const stuckBox = i === k;
        const color = stuckBox ? (s.leaking ? COLOR.slow : COLOR.fast) : COLOR.inkDim;
        return (
          <div key={i} style={{ position: 'absolute', left: boxX(i), top: G.labelY, width: boxW, textAlign: 'center' }}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: TYPE.sectionLabel,
                fontWeight: 700,
                letterSpacing: TRACK.wide - 1,
                color: stuckBox ? color : COLOR.machine,
                whiteSpace: 'nowrap',
                ...MONO_FEATURES,
              }}
            >
              {st.name.toUpperCase()}
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: FONT.sans,
                fontSize: TYPE.sectionSub + 1,
                lineHeight: 1.3,
                color: COLOR.inkDim,
              }}
            >
              {st.detail}
            </div>
          </div>
        );
      })}

      {/* The fix, on the stuck state, once the loop is closed. */}
      {!s.leaking && (
        <div
          style={{
            position: 'absolute',
            left: boxX(k),
            width: boxW,
            top: G.box.top - 22,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Chip text={stage.fixLabel} color={COLOR.fast} />
        </div>
      )}

      <StatStrip stat={stage.stat} reveal={s.statReveal} box={G.strip} />
    </div>
  );
};

const Chip: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span
    style={{
      padding: '2px 6px',
      border: `1px solid ${withAlpha(color, 0.6)}`,
      borderRadius: 3,
      backgroundColor: withAlpha('#0E1620', 0.92),
      fontFamily: FONT.mono,
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: 0.4,
      color,
      whiteSpace: 'nowrap',
      ...MONO_FEATURES,
    }}
  >
    {text}
  </span>
);
