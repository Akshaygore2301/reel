import React from 'react';
import { COLOR, withAlpha } from '../brand/tokens';
import { BELT, beltEnds, type Side } from './geometry';
import { Wire } from './Wire';

/**
 * A belt carrying units from the machine to a screen.
 *
 * The slats scroll and the chips ride; both are driven by values the archetype
 * computes from the shared timeline, never from `useCurrentFrame()` here. A belt
 * that animates on its own clock is the classic way this format loses sync.
 */
export const Conveyor: React.FC<{
  side: Side;
  color: string;
  /** 0..1, wraps. Scroll phase of the slats. */
  phase: number;
  /** Progress (0..1) of each unit currently in transit. */
  chipTs: number[];
  /** Dim the whole belt — used while the slow path is stalled. */
  opacity?: number;
}> = ({ side, color, phase, chipTs, opacity = 1 }) => {
  const { a, b } = beltEnds(side);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;

  const band = BELT.band;
  const lower = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + band });

  const at = (t: number) => ({ x: a.x + dx * t, y: a.y + dy * t });

  return (
    <g opacity={opacity}>
      {/* Ghost rail above the belt: structure the units pass under. */}
      <Wire
        d={`M${a.x},${a.y - 13} L${b.x},${b.y - 13}`}
        color={COLOR.inkFaint}
        w={1}
        glow={0}
        opacity={0.55}
      />
      <Wire
        d={`M${a.x},${a.y - 13} L${a.x},${a.y} M${b.x},${b.y - 13} L${b.x},${b.y}`}
        color={COLOR.inkFaint}
        w={1}
        glow={0}
        opacity={0.4}
      />

      {/* The band. */}
      <path
        d={`M${a.x},${a.y} L${b.x},${b.y} L${lower(b).x},${lower(b).y} L${lower(a).x},${lower(a).y} Z`}
        fill={withAlpha(color, 0.05)}
      />
      <Wire d={`M${a.x},${a.y} L${b.x},${b.y}`} color={color} w={2} glow={3} />
      <Wire d={`M${lower(a).x},${lower(a).y} L${lower(b).x},${lower(b).y}`} color={color} w={2} glow={3} />

      {/* Scrolling slats with their dot feet. */}
      {Array.from({ length: BELT.slats }, (_, i) => {
        const t = ((i + phase) % BELT.slats) / BELT.slats;
        const p = at(t);
        const lp = lower(p);
        // Fade the ends so slats appear and vanish instead of popping.
        const edge = Math.min(t, 1 - t) / 0.06;
        const o = Math.min(1, edge);
        return (
          <g key={i} opacity={o}>
            <line
              x1={p.x}
              y1={p.y}
              x2={lp.x}
              y2={lp.y}
              stroke={color}
              strokeWidth={1.1}
              opacity={0.55}
            />
            <line
              x1={lp.x}
              y1={lp.y}
              x2={lp.x}
              y2={lp.y + BELT.slatDrop}
              stroke={color}
              strokeWidth={1.3}
              opacity={0.8}
            />
            <circle cx={lp.x} cy={lp.y + BELT.slatDrop} r={BELT.slatDotR} fill={color} opacity={0.9} />
          </g>
        );
      })}

      {/* Units in transit, sitting on the upper edge. */}
      {chipTs.map((t, i) => {
        const p = at(t);
        const w = 22;
        const h = 11;
        // Sit the chip on the band, aligned to the belt's direction.
        const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
        return (
          <g key={i} transform={`translate(${p.x},${p.y + band / 2}) rotate(${angle})`}>
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              fill={withAlpha(color, 0.18)}
              stroke={color}
              strokeWidth={1.2}
            />
          </g>
        );
      })}
    </g>
  );
};
