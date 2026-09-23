import React from 'react';
import { FONT } from '../brand/fonts';
import { COLOR, MONO_FEATURES, TRACK, fitMono, withAlpha } from '../brand/tokens';
import type { Stat } from '../schema/fields';

/**
 * The payoff-cycle delta as one horizontal band, for archetypes that have no
 * narrow gap between two screens to wedge `StatDelta` into. Same two halves,
 * same order: the win on the left, the honest caveat on the right.
 */
export const StatStrip: React.FC<{
  stat: Stat;
  reveal: number;
  box: { x: number; y: number; w: number };
}> = ({ stat, reveal, box }) => {
  const half = box.w / 2;
  const label: React.CSSProperties = {
    fontFamily: FONT.mono,
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: TRACK.wide,
    color: COLOR.inkDim,
    whiteSpace: 'nowrap',
    ...MONO_FEATURES,
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * 8}px)`,
      }}
    >
      <div style={{ height: 1, backgroundColor: withAlpha(COLOR.fast, 0.35) }} />
      <div style={{ display: 'flex', marginTop: 10 }}>
        <div style={{ width: half, textAlign: 'center' }}>
          <div style={label}>{stat.firstLabel.toUpperCase()}</div>
          <div
            style={{
              marginTop: 4,
              fontFamily: FONT.mono,
              whiteSpace: 'nowrap',
              lineHeight: 1.15,
              ...MONO_FEATURES,
            }}
          >
            <span
              style={{
                fontSize: fitMono(stat.firstBefore, half / 2 - 24, 19),
                fontWeight: 500,
                color: COLOR.inkFaint,
                textDecoration: 'line-through',
                textDecorationThickness: 1.5,
              }}
            >
              {stat.firstBefore}
            </span>
            <span style={{ fontSize: 15, color: COLOR.inkDim }}>{'  →  '}</span>
            <span
              style={{
                fontSize: fitMono(stat.firstAfter, half / 2 - 24, 26),
                fontWeight: 700,
                color: COLOR.fast,
              }}
            >
              {stat.firstAfter}
            </span>
          </div>
        </div>
        <div style={{ width: 1, backgroundColor: withAlpha(COLOR.inkFaint, 0.5) }} />
        <div style={{ width: half - 1, textAlign: 'center' }}>
          <div style={label}>{stat.lastLabel.toUpperCase()}</div>
          <div
            style={{
              marginTop: 8,
              fontFamily: FONT.mono,
              fontSize: fitMono(stat.lastText, half - 20, 17),
              fontWeight: 500,
              color: COLOR.ink,
              whiteSpace: 'nowrap',
              ...MONO_FEATURES,
            }}
          >
            {stat.lastText}
          </div>
        </div>
      </div>
    </div>
  );
};
