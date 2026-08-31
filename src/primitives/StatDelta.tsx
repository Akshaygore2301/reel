import React from 'react';
import { FONT } from '../brand/fonts';
import { COLOR, MONO_FEATURES, TRACK, fitMono, withAlpha } from '../brand/tokens';
import { STAT } from './geometry';
import type { SplitCompare } from '../schema/scene';

/**
 * The delta panel wedged between the two screens, revealed on the payoff cycle.
 *
 * Two halves on purpose: the win on top (struck-through before, arrow, after) and
 * the honest caveat underneath. Showing only the win would be a lie — the last
 * word still arrives at the same moment either way, and saying so is what makes
 * the rest credible.
 */
export const StatDelta: React.FC<{ stat: SplitCompare['stat']; reveal: number }> = ({
  stat,
  reveal,
}) => {
  /*
   * Only ~76px wide, wedged between the two screens. The labels have to fit on
   * one line at that width, so tracking is dialled back from the usual TRACK.wide
   * and the size is a notch under the standard label scale. Anything wider wraps,
   * and a wrapped "FIRST WORD" reads as a mistake.
   */
  // Usable width inside the panel, minus a little breathing room each side.
  const W = STAT.w - 6;
  const labelTrack = TRACK.wide - 1.2;

  const label = (text: string) =>
    ({
      fontFamily: FONT.mono,
      fontSize: fitMono(text, W, 9.5, labelTrack),
      fontWeight: 500,
      letterSpacing: labelTrack,
      color: COLOR.inkDim,
      whiteSpace: 'nowrap' as const,
      ...MONO_FEATURES,
    }) as const;

  return (
    <div
      style={{
        position: 'absolute',
        left: STAT.x,
        top: STAT.topY,
        width: STAT.w,
        textAlign: 'center',
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * 8}px)`,
      }}
    >
      <div style={{ height: 1, backgroundColor: withAlpha(COLOR.fast, 0.35), marginBottom: 10 }} />

      <div style={label(stat.firstLabel)}>{stat.firstLabel.toUpperCase()}</div>

      <div
        style={{
          marginTop: 5,
          fontFamily: FONT.mono,
          fontSize: fitMono(stat.firstBefore, W, 19),
          fontWeight: 500,
          color: COLOR.inkFaint,
          textDecoration: 'line-through',
          textDecorationThickness: 1.5,
          whiteSpace: 'nowrap',
          ...MONO_FEATURES,
        }}
      >
        {stat.firstBefore}
      </div>

      <div style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.inkDim, lineHeight: 1.4 }}>↓</div>

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: fitMono(stat.firstAfter, W, 26),
          fontWeight: 700,
          color: COLOR.fast,
          lineHeight: 1.15,
          whiteSpace: 'nowrap',
          ...MONO_FEATURES,
        }}
      >
        {stat.firstAfter}
      </div>

      <div
        style={{
          height: 1,
          backgroundColor: withAlpha(COLOR.inkFaint, 0.5),
          margin: '12px 0 8px',
        }}
      />

      <div style={label(stat.lastLabel)}>{stat.lastLabel.toUpperCase()}</div>

      <div
        style={{
          marginTop: 3,
          fontFamily: FONT.mono,
          fontSize: fitMono(stat.lastText, W, 11),
          fontWeight: 500,
          color: COLOR.ink,
          whiteSpace: 'nowrap',
          ...MONO_FEATURES,
        }}
      >
        {stat.lastText}
      </div>
    </div>
  );
};
