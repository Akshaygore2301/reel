import React from 'react';
import { FONT } from '../brand/fonts';
import { COLOR, MONO_FEATURES, TYPE, withAlpha } from '../brand/tokens';

/**
 * The stalled side's only content: a spinner and a climbing clock.
 *
 * The spinner steps in the same 100ms grid as everything else rather than
 * spinning smoothly — a smooth spinner reads as "working", a stepping one reads
 * as "counting", and counting is the point.
 */
export const Timer: React.FC<{
  cx: number;
  cy: number;
  seconds: number;
  label: string;
  color: string;
  /** Monotonic step count driving the spinner's rotation. */
  step: number;
  opacity?: number;
}> = ({ cx, cy, seconds, label, color, step, opacity = 1 }) => {
  const r = 16;
  const rot = step * 30;

  return (
    <div
      style={{
        position: 'absolute',
        left: cx - 90,
        top: cy - 46,
        width: 180,
        textAlign: 'center',
        opacity,
      }}
    >
      <svg width={180} height={40} viewBox={`0 0 180 40`} style={{ display: 'block' }}>
        <g transform={`rotate(${rot} 90 20)`}>
          {/* An arc with a gap, not a full ring — the gap is what shows rotation. */}
          <circle
            cx={90}
            cy={20}
            r={r}
            fill="none"
            stroke={withAlpha(color, 0.2)}
            strokeWidth={2.6}
          />
          <circle
            cx={90}
            cy={20}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * r * 0.78} ${2 * Math.PI * r}`}
          />
        </g>
      </svg>

      <div
        style={{
          marginTop: 2,
          fontFamily: FONT.mono,
          fontSize: TYPE.timerValue,
          fontWeight: 700,
          color,
          lineHeight: 1.1,
          ...MONO_FEATURES,
        }}
      >
        {seconds.toFixed(1)}s
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: FONT.sans,
          fontSize: TYPE.timerSub + 2,
          fontWeight: 500,
          color: COLOR.inkDim,
        }}
      >
        {label}
      </div>
    </div>
  );
};
