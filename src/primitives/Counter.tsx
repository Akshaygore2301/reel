import React from 'react';
import { FONT } from '../brand/fonts';
import { COLOR, MONO_FEATURES, TRACK, TYPE, withAlpha } from '../brand/tokens';

/**
 * "YOU'VE READ  n" — the scoreboard the whole reel hangs on.
 *
 * Tabular figures and a fixed-width box, so the number growing from 1 to 2 digits
 * does not shift anything. The rule above it is a bracket, not a divider: it
 * marks which side of the stage the count belongs to.
 */
export const Counter: React.FC<{
  cx: number;
  y: number;
  label: string;
  value: number;
  color: string;
  /** Brief flash when the value changes. 0..1. */
  flash?: number;
  align: 'left' | 'right';
}> = ({ cx, y, label, value, color, flash = 0, align }) => {
  const W = 150;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - W / 2,
        top: y,
        width: W,
        textAlign: align,
      }}
    >
      <div
        style={{
          height: 1,
          backgroundColor: withAlpha(color, 0.55),
          marginBottom: 8,
          // The bracket sits under the counter's own half of the stage.
          marginLeft: align === 'left' ? 0 : 44,
          marginRight: align === 'right' ? 0 : 44,
        }}
      />
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: TYPE.counterLabel,
          fontWeight: 500,
          letterSpacing: TRACK.wide,
          color: COLOR.inkDim,
          ...MONO_FEATURES,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div
        style={{
          marginTop: 2,
          fontFamily: FONT.mono,
          fontSize: TYPE.counterValue,
          fontWeight: 700,
          lineHeight: 1.1,
          color,
          textShadow: flash > 0 ? `0 0 ${10 * flash}px ${withAlpha(color, 0.7 * flash)}` : undefined,
          ...MONO_FEATURES,
        }}
      >
        {value}
      </div>
    </div>
  );
};
