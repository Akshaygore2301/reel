import React from 'react';
import { FONT } from '../../brand/fonts';
import { COLOR, MONO_FEATURES, TRACK, TYPE, VIDEO, withAlpha } from '../../brand/tokens';
import { COUNTER, mirrorX } from '../../primitives/geometry';
import { Counter } from '../../primitives/Counter';
import { StatStrip } from '../../primitives/StatStrip';
import { Rivet, Wire } from '../../primitives/Wire';
import { formatMs } from '../../primitives/format';
import { useTimelineState } from '../../timeline/context';
import type { FanOut as FanOutStage } from './schema';
import { fanOutTimeline, type Span } from './timeline';

/**
 * Stage geometry, 720x1280. Two waterfalls, one above the other, on ONE time
 * axis: the same calls, the same scale. The sequential lane runs to the far
 * end; the fanned-out lane stops at the slowest call. The gap between the two
 * finish lines is the whole argument, so nothing is allowed to rescale it.
 */
const G = {
  labelX: 34,
  trackX0: 200,
  trackX1: 680,
  seq: { titleY: 488, top: 512, bottom: 626 },
  par: { titleY: 642, top: 666, bottom: 780 },
  joinLabelY: 784,
  axisY: 812,
  strip: { x: 34, y: 852, w: 652 },
} as const;

type Lane = { titleY: number; top: number; bottom: number };

const xOf = (weight: number) => G.trackX0 + ((G.trackX1 - G.trackX0) * weight) / 100;
const rect = (x: number, y: number, w: number, h: number) =>
  `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;

/** Mono advance at 11px, for deciding whether a cost fits after its bar. */
const COST_CHAR = 11 * 0.6;

/**
 * Independent calls in turn vs all at once.
 *
 * Every animated value below is derived from the fanOut timeline's `stateAt`.
 * Nothing here keeps its own clock.
 */
export const FanOut: React.FC<{ stage: FanOutStage }> = ({ stage }) => {
  const s = useTimelineState(fanOutTimeline(stage));
  const { layout } = s;
  const n = stage.calls.length;

  const fade = 1 - s.resetProgress;
  const tickFlash = Math.max(0, 1 - s.sinceTick / 2);
  const handoffFlash = Math.max(0, 1 - s.sinceHandoff / 5);
  const joinFlash = s.sinceJoin >= 0 ? Math.max(0, 1 - s.sinceJoin / 6) : 0;
  const head = xOf(s.progress);

  const rowY = (lane: Lane, i: number) => {
    const pitch = (lane.bottom - lane.top) / n;
    return lane.top + pitch * (i + 0.5);
  };
  const barH = Math.min(16, (G.seq.bottom - G.seq.top) / n - 10);

  const bars = (lane: Lane, spans: Span[], color: string, activeOf: (i: number) => boolean) =>
    spans.map((span, i) => {
      const y = rowY(lane, i);
      const filled = Math.max(0, Math.min(s.progress, span.end) - span.start);
      const active = activeOf(i);
      const box = rect(xOf(span.start), y - barH / 2, xOf(span.start + filled) - xOf(span.start), barH);
      return (
        <g key={i}>
          <Wire d={`M${G.trackX0},${y} L${G.trackX1},${y}`} color={COLOR.rule} w={1} glow={0} />
          {filled > 0 && (
            <>
              <path d={box} fill={withAlpha(color, active ? 0.2 + 0.08 * tickFlash : 0.14)} />
              <Wire d={box} color={color} w={1.6} glow={active ? 3 : 2} />
            </>
          )}
          <Rivet
            cx={G.trackX0 - 10}
            cy={y}
            r={2.6}
            color={color}
            opacity={s.progress > span.start ? (active ? 1 : 0.6) : 0.2}
          />
        </g>
      );
    });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      <svg
        width={VIDEO.width}
        height={VIDEO.height}
        viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Time axis, shared by both lanes. */}
        <Wire d={`M${G.trackX0},${G.axisY} L${G.trackX1},${G.axisY}`} color={COLOR.inkFaint} w={1} glow={0} />
        {Array.from({ length: 11 }, (_, k) => (
          <Wire
            key={k}
            d={`M${xOf(k * 10)},${G.axisY} L${xOf(k * 10)},${G.axisY + (k % 5 === 0 ? 7 : 4)}`}
            color={COLOR.inkFaint}
            w={1}
            glow={0}
          />
        ))}

        {/* ---- in turn: each call waits for the one before ---- */}
        {bars(G.seq, layout.seq, COLOR.slow, (i) => s.seqActive === i)}
        {layout.seq.slice(0, -1).map(
          (span, i) =>
            s.progress >= span.end && (
              <Wire
                key={i}
                d={`M${xOf(span.end)},${rowY(G.seq, i) + barH / 2} L${xOf(span.end)},${rowY(G.seq, i + 1) - barH / 2}`}
                color={COLOR.slow}
                w={1.2}
                glow={0}
                opacity={0.7}
                dash="2 3"
              />
            ),
        )}
        {s.seqActive >= 0 && (
          <Rivet cx={head} cy={rowY(G.seq, s.seqActive)} r={3.4 + 1.2 * handoffFlash} color={COLOR.ink} />
        )}

        {/* ---- all at once: every call starts at zero ---- */}
        {/* A single fork from the lane's origin into every row, so they read as fired together. */}
        <Wire
          d={`M${G.trackX0 - 10},${rowY(G.par, 0)} L${G.trackX0 - 10},${rowY(G.par, n - 1)}`}
          color={COLOR.fast}
          w={1.2}
          glow={0}
          opacity={0.5}
        />
        {bars(G.par, layout.par, COLOR.fast, (i) => !s.joined && s.progress < layout.par[i].end)}

        {/* The join: a hard line where the slowest call returns. */}
        {s.joined && (
          <Wire
            d={`M${xOf(layout.join)},${G.par.top - 6} L${xOf(layout.join)},${G.joinLabelY - 2}`}
            color={COLOR.fast}
            w={1.8}
            glow={2 + 2 * joinFlash}
          />
        )}

        {/* Playhead: now, through both lanes. */}
        <Wire
          d={`M${head},${G.seq.top - 8} L${head},${G.axisY}`}
          color={COLOR.ink}
          w={1}
          glow={0}
          opacity={s.done ? 0.18 : 0.32}
        />
      </svg>

      {/* ---- counters ---- */}
      <Counter
        cx={COUNTER.leftCx}
        y={COUNTER.y}
        label={stage.clockLabel}
        value={formatMs((stage.totalMs * s.seqClock) / 100)}
        color={COLOR.slow}
        flash={tickFlash}
        align="left"
      />
      <Counter
        cx={mirrorX(COUNTER.leftCx)}
        y={COUNTER.y}
        label={stage.clockLabel}
        value={formatMs((stage.totalMs * s.parClock) / 100)}
        color={COLOR.fast}
        flash={s.joined ? joinFlash : tickFlash}
        align="right"
      />

      <LaneTitle y={G.seq.titleY} title={stage.seq.title} sub={stage.seq.sub} color={COLOR.slow} />
      <LaneTitle y={G.par.titleY} title={stage.par.title} sub={stage.par.sub} color={COLOR.fast} />

      {/* ---- call names and costs ---- */}
      {stage.calls.map((call, i) => (
        <React.Fragment key={i}>
          {([
            [G.seq, layout.seq[i], COLOR.slow],
            [G.par, layout.par[i], COLOR.fast],
          ] as const).map(([lane, span, color], j) => (
            <React.Fragment key={j}>
              <Name y={rowY(lane, i)} text={call.name} color={s.progress > span.start ? color : COLOR.inkDim} />
              {s.progress >= span.end && <Cost y={rowY(lane, i)} end={span.end} text={call.cost} color={color} />}
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}

      {s.joined && (
        <Tag x={xOf(layout.join)} y={G.joinLabelY} text={stage.par.join} color={COLOR.fast} opacity={0.6 + 0.4 * joinFlash} />
      )}

      {/* ---- axis labels ---- */}
      <AxisLabel x={G.trackX0} align="left" text="0" color={COLOR.inkFaint} />
      <AxisLabel x={G.trackX1} align="right" text={formatMs(stage.totalMs)} color={s.done ? COLOR.slow : COLOR.inkDim} />
      {s.joined && (
        <AxisLabel
          x={xOf(layout.join)}
          align="center"
          text={formatMs((stage.totalMs * layout.exactJoin) / 100)}
          color={COLOR.fast}
        />
      )}

      <StatStrip stat={stage.stat} reveal={s.statReveal} box={G.strip} />
    </div>
  );
};

const mono: React.CSSProperties = { fontFamily: FONT.mono, whiteSpace: 'nowrap', ...MONO_FEATURES };

const LaneTitle: React.FC<{ y: number; title: string; sub: string; color: string }> = ({ y, title, sub, color }) => (
  <div style={{ position: 'absolute', left: G.labelX, top: y, whiteSpace: 'nowrap' }}>
    <span style={{ ...mono, fontSize: TYPE.sectionLabel + 1, fontWeight: 700, letterSpacing: TRACK.wide, color }}>
      {title.toUpperCase()}
    </span>
    <span style={{ marginLeft: 12, fontFamily: FONT.sans, fontSize: TYPE.sectionSub + 1, color: COLOR.inkDim }}>
      {sub}
    </span>
  </div>
);

const Name: React.FC<{ y: number; text: string; color: string }> = ({ y, text, color }) => (
  <div
    style={{
      ...mono,
      position: 'absolute',
      left: G.labelX,
      top: y - 7,
      fontSize: TYPE.sectionLabel,
      fontWeight: 700,
      letterSpacing: TRACK.wide - 0.8,
      color,
    }}
  >
    {text.toUpperCase()}
  </div>
);

/** A call's cost after its bar, or inside it when the bar runs to the edge. */
const Cost: React.FC<{ y: number; end: number; text: string; color: string }> = ({ y, end, text, color }) => {
  const w = text.length * COST_CHAR;
  const outside = xOf(end) + 8 + w <= G.trackX1 + 6;
  return (
    <div
      style={{
        ...mono,
        position: 'absolute',
        top: y - 8,
        ...(outside ? { left: xOf(end) + 8 } : { left: xOf(end) - 8 - w, width: w, textAlign: 'right' }),
        fontSize: 11,
        fontWeight: 700,
        color: outside ? color : COLOR.ink,
      }}
    >
      {text}
    </div>
  );
};

const Tag: React.FC<{ x: number; y: number; text: string; color: string; opacity: number }> = ({
  x,
  y,
  text,
  color,
  opacity,
}) => (
  <div
    style={{
      ...mono,
      position: 'absolute',
      left: x - 80,
      top: y,
      width: 160,
      textAlign: 'center',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: TRACK.wide - 1,
      color,
      opacity,
    }}
  >
    {text}
  </div>
);

const AxisLabel: React.FC<{ x: number; align: 'left' | 'right' | 'center'; text: string; color: string }> = ({
  x,
  align,
  text,
  color,
}) => {
  const W = 90;
  const left = align === 'left' ? x : align === 'right' ? x - W : x - W / 2;
  return (
    <div
      style={{
        ...mono,
        position: 'absolute',
        top: G.axisY + 10,
        left,
        width: W,
        textAlign: align,
        fontSize: 10,
        fontWeight: 500,
        color,
      }}
    >
      {text}
    </div>
  );
};
