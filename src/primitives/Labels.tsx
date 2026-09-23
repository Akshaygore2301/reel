import React from 'react';
import { FONT } from '../brand/fonts';
import { COLOR, MONO_FEATURES, TRACK, TYPE } from '../brand/tokens';

/** A wide-tracked mono label with a sentence-case gloss under it, centred on `cx`. */
export const LabelBlock: React.FC<{
  cx: number;
  y: number;
  label: string;
  sub: string;
  color: string;
}> = ({ cx, y, label, sub, color }) => (
  <div
    style={{
      position: 'absolute',
      left: cx - 130,
      top: y,
      width: 260,
      textAlign: 'center',
    }}
  >
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: TYPE.sectionLabel,
        fontWeight: 700,
        letterSpacing: TRACK.wide,
        color,
        ...MONO_FEATURES,
      }}
    >
      {label.toUpperCase()}
    </div>
    <div
      style={{
        marginTop: 4,
        fontFamily: FONT.sans,
        fontSize: TYPE.sectionSub + 2,
        fontWeight: 400,
        color: COLOR.inkDim,
      }}
    >
      {sub}
    </div>
  </div>
);

/** The title under one side of the stage: the approach, and what it means. */
export const TitleBlock: React.FC<{
  cx: number;
  y: number;
  title: string;
  sub: string;
  color: string;
}> = ({ cx, y, title, sub, color }) => (
  <div
    style={{
      position: 'absolute',
      left: cx - 170,
      top: y,
      width: 340,
      textAlign: 'center',
    }}
  >
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: TYPE.sectionLabel + 2,
        fontWeight: 700,
        letterSpacing: TRACK.wide,
        color,
        ...MONO_FEATURES,
      }}
    >
      {title.toUpperCase()}
    </div>
    <div
      style={{
        marginTop: 5,
        fontFamily: FONT.sans,
        fontSize: TYPE.sectionSub + 2,
        fontWeight: 400,
        color: COLOR.inkDim,
      }}
    >
      {sub}
    </div>
  </div>
);
