import React from 'react';
import { FONT } from '../../brand/fonts';
import { COLOR, MONO_FEATURES, TRACK, TYPE, VIDEO, withAlpha } from '../../brand/tokens';
import { COUNTER, mirrorX } from '../../primitives/geometry';
import { Counter } from '../../primitives/Counter';
import { StatStrip } from '../../primitives/StatStrip';
import { Rivet, Wire } from '../../primitives/Wire';
import { formatMs } from '../../primitives/format';
import { useTimelineState } from '../../timeline/context';
import type { Pipeline as PipelineStage } from './schema';
import { pipelineTimeline } from './timeline';

/**
 * Stage geometry, 720x1280. A waterfall: one row per stage, stage names in a
 * left column, bars on a shared time track that starts where the previous
 * stage ended. The track is scaled to the UNFIXED total, so on the payoff cycle
 * the fixed path visibly stops short of the old finish line.
 */
const G = {
  rowsTop: 482,
  rowsBottom: 800,
  labelX: 34,
  labelW: 212,
  trackX0: 258,
  trackX1: 680,
  barH: 20,
  axisY: 818,
  strip: { x: 34, y: 852, w: 652 },
} as const;

const xOf = (weight: number) => G.trackX0 + ((G.trackX1 - G.trackX0) * weight) / 100;
const rect = (x: number, y: number, w: number, h: number) =>
  `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;

/** Mono advance at 11px, for deciding whether a cost fits after its bar. */
const COST_CHAR = 11 * 0.6;

/**
 * One request walking a path of stages; the point is where the time goes.
 *
 * Every animated value below is derived from the pipeline timeline's
 * `stateAt`. Nothing here keeps its own clock.
 */
export const Pipeline: React.FC<{ stage: PipelineStage }> = ({ stage }) => {
  const s = useTimelineState(pipelineTimeline(stage));
  const { layout } = s;
  const n = stage.stages.length;
  const pitch = (G.rowsBottom - G.rowsTop) / n;
  const cy = (i: number) => G.rowsTop + pitch * (i + 0.5);

  const fade = 1 - s.resetProgress;
  const tickFlash = Math.max(0, 1 - s.sinceTick / 2);
  const handoffFlash = Math.max(0, 1 - s.sinceHandoff / 5);
  const head = xOf(s.progress);

  // The original bottleneck span, drawn as a ghost behind the fixed one.
  const original = stage.stages.slice(0, layout.bottleneck).reduce((a, st) => a + st.weight, 0);
  const ghost = { start: layout.spans[layout.bottleneck].start, end: original + stage.stages[layout.bottleneck].weight };

  const colorOf = (i: number) =>
    i === layout.bottleneck && !layout.fixed ? COLOR.slow : COLOR.fast;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      <svg
        width={VIDEO.width}
        height={VIDEO.height}
        viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Time axis: the unfixed total is the far end. */}
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

        {layout.spans.map((span, i) => {
          const y = cy(i);
          const color = colorOf(i);
          const reached = s.progress > span.start || s.done;
          const filled = Math.max(0, Math.min(s.progress, span.end) - span.start);
          const isActive = s.active === i;

          return (
            <g key={i}>
              {/* The row's rail, full width, so empty time reads as empty. */}
              <Wire d={`M${G.trackX0},${y} L${G.trackX1},${y}`} color={COLOR.rule} w={1} glow={0} />

              {layout.fixed && i === layout.bottleneck && (
                <Wire
                  d={rect(xOf(ghost.start), y - G.barH / 2, xOf(ghost.end) - xOf(ghost.start), G.barH)}
                  color={COLOR.slow}
                  w={1.2}
                  glow={0}
                  opacity={0.45}
                  dash="4 4"
                />
              )}

              {filled > 0 && (
                <>
                  <path
                    d={rect(xOf(span.start), y - G.barH / 2, xOf(span.start + filled) - xOf(span.start), G.barH)}
                    fill={withAlpha(color, isActive ? 0.2 + 0.08 * tickFlash : 0.14)}
                  />
                  <Wire
                    d={rect(xOf(span.start), y - G.barH / 2, xOf(span.start + filled) - xOf(span.start), G.barH)}
                    color={color}
                    w={1.6}
                    glow={isActive ? 3 : 2}
                  />
                </>
              )}

              {/* Handoff: a drop line from this bar's end into the next row. */}
              {i < n - 1 && s.progress >= span.end && (
                <Wire
                  d={`M${xOf(span.end)},${y + G.barH / 2} L${xOf(span.end)},${cy(i + 1) - G.barH / 2}`}
                  color={colorOf(i + 1)}
                  w={1.2}
                  glow={0}
                  opacity={0.7}
                  dash="2 3"
                />
              )}

              {reached && <Rivet cx={G.trackX0 - 10} cy={y} r={2.6} color={color} opacity={isActive ? 1 : 0.6} />}
            </g>
          );
        })}

        {/* The request itself: a bright head riding the active bar. */}
        {s.active >= 0 && (
          <Rivet cx={head} cy={cy(s.active)} r={3.4 + 1.2 * handoffFlash} color={COLOR.ink} />
        )}

        {/* Playhead: now. */}
        <Wire
          d={`M${head},${G.rowsTop - 10} L${head},${G.axisY}`}
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
        label={stage.unitLabel}
        value={`${s.stagesDone}/${n}`}
        color={COLOR.fast}
        flash={handoffFlash}
        align="left"
      />
      <Counter
        cx={mirrorX(COUNTER.leftCx)}
        y={COUNTER.y}
        label={stage.clockLabel}
        value={formatMs((stage.totalMs * s.clockWeight) / 100)}
        color={layout.fixed ? COLOR.fast : COLOR.slow}
        flash={tickFlash}
        align="right"
      />

      {/* ---- stage labels ---- */}
      {stage.stages.map((st, i) => {
        const span = layout.spans[i];
        const reached = s.progress > span.start || s.done;
        const complete = s.progress >= span.end;
        const cost = layout.fixed && i === layout.bottleneck ? stage.fix.cost : st.cost;
        const costW = cost.length * COST_CHAR;
        const outside = xOf(span.end) + 8 + costW <= G.trackX1 + 6;
        const color = colorOf(i);

        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: G.labelX,
                top: cy(i) - 17,
                width: G.labelW,
              }}
            >
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: TYPE.sectionLabel,
                  fontWeight: 700,
                  letterSpacing: TRACK.wide - 0.6,
                  color: reached ? color : COLOR.inkDim,
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
                  color: COLOR.inkDim,
                  whiteSpace: 'nowrap',
                }}
              >
                {st.detail}
              </div>
            </div>

            {complete && (
              <div
                style={{
                  position: 'absolute',
                  top: cy(i) - 8,
                  ...(outside
                    ? { left: xOf(span.end) + 8 }
                    : { left: xOf(span.end) - 8 - costW, width: costW, textAlign: 'right' }),
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  color: outside ? color : COLOR.ink,
                  whiteSpace: 'nowrap',
                  ...MONO_FEATURES,
                }}
              >
                {cost}
              </div>
            )}

            {layout.fixed && i === layout.bottleneck && (
              <div
                style={{
                  position: 'absolute',
                  top: cy(i) - G.barH / 2 - 17,
                  left: xOf(ghost.start),
                  width: xOf(ghost.end) - xOf(ghost.start),
                  textAlign: 'center',
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  fontWeight: 500,
                  letterSpacing: TRACK.wide - 0.8,
                  color: withAlpha(COLOR.slow, 0.8),
                  whiteSpace: 'nowrap',
                  ...MONO_FEATURES,
                }}
              >
                {stage.fix.label.toUpperCase()}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* ---- axis labels ---- */}
      <AxisLabel x={G.trackX0} align="left" text="0" color={COLOR.inkFaint} />
      <AxisLabel
        x={G.trackX1}
        align="right"
        text={formatMs(stage.totalMs)}
        color={layout.fixed ? withAlpha(COLOR.slow, 0.8) : COLOR.inkDim}
      />
      {layout.fixed && s.done && (
        <AxisLabel
          x={xOf(layout.total)}
          align="center"
          text={formatMs((stage.totalMs * layout.exactTotal) / 100)}
          color={COLOR.fast}
        />
      )}

      <StatStrip stat={stage.stat} reveal={s.statReveal} box={G.strip} />
    </div>
  );
};

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
        position: 'absolute',
        top: G.axisY + 10,
        left,
        width: W,
        textAlign: align,
        fontFamily: FONT.mono,
        fontSize: 10,
        fontWeight: 500,
        color,
        ...MONO_FEATURES,
      }}
    >
      {text}
    </div>
  );
};
