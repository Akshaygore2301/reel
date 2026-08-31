import React from 'react';
import { withAlpha } from '../brand/tokens';

/**
 * A wireframe stroke. Drawn twice: a wide translucent pass for the glow, then a
 * crisp pass on top.
 *
 * Deliberately NOT an SVG blur filter — a filter re-rasterises the whole subtree
 * every frame in headless Chrome, which roughly triples render time here, and the
 * double-stroke is visually indistinguishable at 720px.
 */
export const Wire: React.FC<{
  d: string;
  color: string;
  /** Crisp stroke width. */
  w?: number;
  /** Glow spread multiplier. 0 disables the glow pass. */
  glow?: number;
  opacity?: number;
  fill?: string;
  dash?: string;
  cap?: 'butt' | 'round' | 'square';
}> = ({ d, color, w = 2, glow = 3, opacity = 1, fill = 'none', dash, cap = 'round' }) => (
  <>
    {glow > 0 && (
      <path
        d={d}
        stroke={withAlpha(color, 0.13 * opacity)}
        strokeWidth={w * glow}
        strokeLinecap={cap}
        strokeLinejoin="round"
        fill="none"
      />
    )}
    <path
      d={d}
      stroke={color}
      strokeWidth={w}
      strokeLinecap={cap}
      strokeLinejoin="round"
      strokeDasharray={dash}
      fill={fill}
      opacity={opacity}
    />
  </>
);

/** Filled rivet at a joint. The reference puts these at every corner and foot. */
export const Rivet: React.FC<{ cx: number; cy: number; r?: number; color: string; opacity?: number }> = ({
  cx,
  cy,
  r = 3,
  color,
  opacity = 1,
}) => (
  <>
    <circle cx={cx} cy={cy} r={r * 2.4} fill={withAlpha(color, 0.14 * opacity)} />
    <circle cx={cx} cy={cy} r={r} fill={color} opacity={opacity} />
  </>
);
