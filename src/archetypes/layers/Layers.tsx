import React from 'react';
import { FONT } from '../../brand/fonts';
import { COLOR, MONO_FEATURES, TRACK, TYPE, VIDEO, withAlpha } from '../../brand/tokens';
import { COUNTER, mirrorX } from '../../primitives/geometry';
import { Counter } from '../../primitives/Counter';
import { StatStrip } from '../../primitives/StatStrip';
import { Rivet, Wire } from '../../primitives/Wire';
import { formatMs } from '../../primitives/format';
import { useTimelineState } from '../../timeline/context';
import type { Layers as LayersStage } from './schema';
import { layersTimeline, type LayerStatus } from './timeline';

/**
 * Stage geometry, 720x1280. A spine on the left carries the request down and
 * the answer back up; each layer is a slab hanging off it. Slabs widen as they
 * get slower, so depth reads as "bigger, further, slower" before any label is
 * read.
 */
const G = {
  spineX: 62,
  slabX: 92,
  /** Right edge of the top slab and of the bottom one; the rest interpolate. */
  rightTop: 452,
  rightBottom: 686,
  top: 492,
  bottom: 820,
  maxPitch: 74,
  strip: { x: 34, y: 852, w: 652 },
} as const;

const rect = (x: number, y: number, w: number, h: number) =>
  `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;

const CHIP: Record<LayerStatus, { text: string; color: string } | null> = {
  idle: null,
  asking: null,
  skipped: null,
  miss: { text: 'MISS', color: COLOR.slow },
  found: null, // label depends on warm vs cold, below
  stored: { text: 'STORED', color: COLOR.fast },
};

/**
 * One request falling through layers until one can answer.
 *
 * Every animated value below is derived from the layers timeline's `stateAt`.
 * Nothing here keeps its own clock.
 */
export const Layers: React.FC<{ stage: LayersStage }> = ({ stage }) => {
  const s = useTimelineState(layersTimeline(stage));
  const n = stage.layers.length;

  const pitch = Math.min(G.maxPitch, (G.bottom - G.top) / n);
  const stackTop = G.top + ((G.bottom - G.top) - pitch * n) / 2;
  const slabH = pitch - 16;
  const cy = (i: number) => stackTop + pitch * (i + 0.5);
  const right = (i: number) => G.rightTop + ((G.rightBottom - G.rightTop) * i) / (n - 1);
  const entryY = stackTop - 18;

  const fade = 1 - s.resetProgress;
  const tickFlash = Math.max(0, 1 - s.sinceTick / 2);
  const arriveFlash = Math.max(0, 1 - s.sinceArrive / 5);
  const foundFlash = s.sinceFound >= 0 ? Math.max(0, 1 - s.sinceFound / 8) : 0;

  const packetY = s.at < 0 ? entryY + (cy(0) - entryY) * (s.at + 1) : cy(0) + pitch * s.at;
  const packetColor = s.returning ? COLOR.fast : COLOR.ink;

  // The cold trip is the thing being argued against; the warm hit is the thing argued for.
  const foundColor = s.warm ? COLOR.fast : COLOR.slow;

  const colorOf = (st: LayerStatus) =>
    st === 'asking'
      ? COLOR.machine
      : st === 'miss'
        ? COLOR.slow
        : st === 'found'
          ? foundColor
          : st === 'stored'
            ? COLOR.fast
            : COLOR.inkFaint;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      <svg
        width={VIDEO.width}
        height={VIDEO.height}
        viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* The spine. Lit down to wherever the request has been this cycle. */}
        <Wire d={`M${G.spineX},${entryY} L${G.spineX},${cy(n - 1)}`} color={COLOR.rule} w={1.4} glow={0} />
        <Wire
          d={`M${G.spineX},${entryY} L${G.spineX},${s.returning ? cy(s.target) : packetY}`}
          color={s.returning ? foundColor : COLOR.machine}
          w={1.4}
          glow={2}
          opacity={0.7}
        />
        <Rivet cx={G.spineX} cy={entryY} r={3} color={COLOR.machine} />

        {stage.layers.map((_, i) => {
          const st = s.status[i];
          const color = colorOf(st);
          const y = cy(i) - slabH / 2;
          const w = right(i) - G.slabX;
          const lit = st !== 'idle' && st !== 'skipped';
          const flash = st === 'asking' ? arriveFlash : st === 'found' ? foundFlash : 0;
          return (
            <g key={i}>
              {/* Port: the branch from the spine into the slab. */}
              <Wire
                d={`M${G.spineX},${cy(i)} L${G.slabX},${cy(i)}`}
                color={lit ? color : COLOR.rule}
                w={1.2}
                glow={0}
                opacity={lit ? 0.9 : 1}
              />
              <Rivet cx={G.spineX} cy={cy(i)} r={2.4} color={lit ? color : COLOR.inkFaint} opacity={lit ? 1 : 0.5} />

              <path
                d={rect(G.slabX, y, w, slabH)}
                fill={withAlpha(lit ? color : '#0A1017', lit ? 0.06 + 0.1 * flash + (st === 'found' ? 0.06 : 0) : 0.8)}
              />
              <Wire
                d={rect(G.slabX, y, w, slabH)}
                color={lit ? color : COLOR.inkFaint}
                w={st === 'found' ? 2.2 : 1.6}
                glow={lit ? 2 + 2 * flash : 0}
                opacity={st === 'skipped' ? 0.45 : lit ? 1 : 0.7}
                dash={st === 'skipped' ? '5 5' : undefined}
              />
            </g>
          );
        })}

        {/* The request going down, the answer coming back. */}
        {!s.done && <Rivet cx={G.spineX} cy={packetY} r={3.6 + 1.2 * arriveFlash} color={packetColor} />}
      </svg>

      {/* ---- counters ---- */}
      <Counter
        cx={COUNTER.leftCx}
        y={COUNTER.y}
        label={stage.unitLabel}
        value={`${s.asked}/${n}`}
        color={COLOR.machine}
        flash={arriveFlash}
        align="left"
      />
      <Counter
        cx={mirrorX(COUNTER.leftCx)}
        y={COUNTER.y}
        label={stage.clockLabel}
        value={formatMs(s.clockMs)}
        color={s.warm ? COLOR.fast : COLOR.slow}
        flash={s.returning ? foundFlash : tickFlash}
        align="right"
      />

      {/* ---- slab labels ---- */}
      {stage.layers.map((layer, i) => {
        const st = s.status[i];
        const lit = st !== 'idle' && st !== 'skipped';
        const chip = st === 'found' ? { text: s.warm ? 'HIT' : 'ORIGIN', color: foundColor } : CHIP[st];
        const r = right(i);
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: G.slabX + 14, top: cy(i) - 16, whiteSpace: 'nowrap' }}>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: TYPE.sectionLabel,
                  fontWeight: 700,
                  letterSpacing: TRACK.wide - 0.6,
                  color: lit ? colorOf(st) : COLOR.inkDim,
                  ...MONO_FEATURES,
                }}
              >
                {layer.name.toUpperCase()}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: FONT.sans,
                  fontSize: TYPE.sectionSub + 1,
                  color: COLOR.inkDim,
                  opacity: st === 'skipped' ? 0.6 : 1,
                }}
              >
                {layer.detail}
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                left: r - 14 - 180,
                width: 180,
                top: cy(i) - 9,
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 10,
                whiteSpace: 'nowrap',
              }}
            >
              {chip && <Chip text={chip.text} color={chip.color} />}
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 13,
                  fontWeight: 700,
                  color: lit ? COLOR.ink : COLOR.inkFaint,
                  ...MONO_FEATURES,
                }}
              >
                {formatMs(layer.ms)}
              </span>
            </div>
          </React.Fragment>
        );
      })}

      <StatStrip stat={stage.stat} reveal={s.statReveal} box={G.strip} />
    </div>
  );
};

/** A status tag, bordered like the word chips on splitCompare's screens. */
const Chip: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span
    style={{
      padding: '2px 6px',
      border: `1px solid ${withAlpha(color, 0.6)}`,
      borderRadius: 3,
      backgroundColor: withAlpha(color, 0.1),
      fontFamily: FONT.mono,
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: TRACK.wide - 1,
      color,
      ...MONO_FEATURES,
    }}
  >
    {text}
  </span>
);
