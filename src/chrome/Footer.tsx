import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { FONT } from '../brand/fonts';
import { COLOR, LAYOUT, MONO_FEATURES, TRACK, TYPE, withAlpha } from '../brand/tokens';
import { stateAt } from '../timeline/beats';
import { captionAt } from '../timeline/anchors';
import type { Scene } from '../schema/scene';

/** How long the pill takes to swap text. Short — it should feel like a cut. */
const SWAP_FRAMES = 5;

/**
 * Caption pill + hairline + credits.
 *
 * The pill carries the actual argument of the reel; the credits only appear with
 * the stinger on the payoff cycle, which is what makes the second cycle feel
 * like a conclusion rather than a repeat.
 */
export const Footer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const state = stateAt(frame);
  const caption = captionAt(scene.captions, frame);

  // Swap in with a small rise; fade out at the tail for a seamless loop.
  const entry = caption
    ? interpolate(frame - caption.enteredAt, [0, SWAP_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  const pillOpacity = entry * state.tailFade;

  const reveal = state.payoffProgress;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: LAYOUT.footerPillY,
          left: 0,
          width: 720,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          key={caption?.index ?? -1}
          style={{
            opacity: pillOpacity,
            transform: `translateY(${(1 - entry) * 6}px)`,
            padding: '11px 22px',
            borderRadius: 999,
            border: `1px solid ${withAlpha(COLOR.fast, 0.42)}`,
            backgroundColor: withAlpha('#0E1620', 0.92),
            fontFamily: FONT.sans,
            fontSize: TYPE.caption,
            fontWeight: 700,
            color: COLOR.ink,
            letterSpacing: -0.2,
            whiteSpace: 'nowrap',
          }}
        >
          {caption?.text ?? ''}
        </div>
      </div>

      {/* Hairline + credits: the payoff reveal. */}
      <div
        style={{
          position: 'absolute',
          top: LAYOUT.footerRuleY,
          left: LAYOUT.gutter,
          width: 720 - LAYOUT.gutter * 2,
          height: 1,
          backgroundColor: COLOR.rule,
          opacity: reveal,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: LAYOUT.footerCreditY,
          left: LAYOUT.gutter,
          width: 720 - LAYOUT.gutter * 2,
          textAlign: 'center',
          opacity: reveal,
          transform: `translateY(${(1 - reveal) * 5}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: TYPE.credit,
            fontWeight: 700,
            letterSpacing: TRACK.wide,
            ...MONO_FEATURES,
          }}
        >
          <span style={{ color: COLOR.fast }}>{scene.credits.lead.toUpperCase()}</span>
          <span style={{ color: COLOR.inkDim, fontWeight: 400 }}>
            {' '}
            {scene.credits.tail.toUpperCase()}
          </span>
        </div>

        <div
          style={{
            marginTop: 7,
            fontFamily: FONT.mono,
            fontSize: TYPE.creditSmall,
            fontWeight: 400,
            letterSpacing: TRACK.wide,
            color: COLOR.inkFaint,
            ...MONO_FEATURES,
          }}
        >
          {scene.credits.tags.map((t) => t.toUpperCase()).join('  ·  ')}
        </div>
      </div>
    </>
  );
};
