import React from 'react';
import { FONT } from '../brand/fonts';
import { COLOR, LAYOUT, MONO_FEATURES, TRACK, TYPE } from '../brand/tokens';
import type { Scene } from '../schema/scene';

/**
 * Fixed header. Four lines, tight leading, centred:
 *
 *   @handle                       dim, small
 *   LABEL · slow vs fast          mono, wide-tracked, slow value in amber
 *   Lead Accent                   the title, two-tone
 *   subtitle                      blue, lower case
 *
 * Never animates. It is the constant that makes a series recognisable.
 */
export const Header: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { stat, title, subtitle } = scene.header;

  return (
    <div
      style={{
        position: 'absolute',
        top: LAYOUT.headerTop,
        left: LAYOUT.gutter,
        width: 720 - LAYOUT.gutter * 2,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: TYPE.handle,
          fontWeight: 400,
          color: COLOR.inkDim,
          letterSpacing: 0.2,
        }}
      >
        {scene.handle}
      </div>

      <div
        style={{
          marginTop: 9,
          fontFamily: FONT.mono,
          fontSize: TYPE.statLine,
          fontWeight: 500,
          letterSpacing: TRACK.wide,
          color: COLOR.inkDim,
          ...MONO_FEATURES,
        }}
      >
        {stat.label.toUpperCase()}
        <span style={{ color: COLOR.inkFaint }}>{' · '}</span>
        <span style={{ color: COLOR.slow }}>{stat.slow}</span>
        <span style={{ color: COLOR.inkFaint }}>{' vs '}</span>
        <span style={{ color: COLOR.ink }}>{stat.fast}</span>
      </div>

      <div
        style={{
          marginTop: 4,
          fontFamily: FONT.sans,
          fontSize: TYPE.title,
          fontWeight: 500,
          letterSpacing: -1.1,
          lineHeight: 1.12,
          color: COLOR.ink,
        }}
      >
        {title.lead} <span style={{ color: COLOR.fast, fontWeight: 700 }}>{title.accent}</span>
      </div>

      <div
        style={{
          marginTop: 6,
          fontFamily: FONT.sans,
          fontSize: TYPE.subtitle,
          fontWeight: 500,
          color: COLOR.accentLink,
          letterSpacing: 0.1,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};
