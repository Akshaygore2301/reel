import React from 'react';
import { FONT } from '../brand/fonts';
import { MONO_FEATURES, TYPE, withAlpha } from '../brand/tokens';

/** Empty placeholder chips drawn after the last arrived word. */
const LOOKAHEAD = 3;

/**
 * Text arriving one word at a time, each word boxed as its own chip.
 *
 * The chips matter: they make discrete units visible, so "word by word" is
 * something you can see rather than something the caption has to assert. A few
 * empty chips run ahead of the text to imply more is coming.
 *
 * Reveal is a pure function of `revealed` — no per-word timers, no CSS
 * transitions. Frame N always renders identically, which is what makes a render
 * reproducible and a still frame comparable against the reference.
 */
export const TokenText: React.FC<{
  words: string[];
  /** How many words have arrived. */
  revealed: number;
  /** Show placeholder chips for words still in flight. */
  lookahead?: boolean;
  /** Highlight the most recent chip. 0..1. */
  flash?: number;
  color: string;
  box: { left: number; top: number; width: number; height: number };
}> = ({ words, revealed, lookahead = true, flash = 0, color, box }) => {
  const shown = words.slice(0, revealed);
  const pending = lookahead ? Math.min(LOOKAHEAD, Math.max(0, words.length - revealed)) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        padding: '8px 9px',
        boxSizing: 'border-box',
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        gap: '3px 3px',
        overflow: 'hidden',
      }}
    >
      {shown.map((w, i) => {
        const isLast = i === shown.length - 1;
        return (
          <span
            key={i}
            style={{
              fontFamily: FONT.mono,
              fontSize: TYPE.screenText - 0.5,
              fontWeight: 400,
              lineHeight: 1.25,
              color: '#FFFFFF',
              padding: '0px 3px',
              border: `1px solid ${withAlpha('#FFFFFF', isLast ? 0.28 + flash * 0.5 : 0.26)}`,
              backgroundColor: isLast ? withAlpha(color, 0.13 + flash * 0.2) : 'transparent',
              ...MONO_FEATURES,
            }}
          >
            {w}
          </span>
        );
      })}

      {Array.from({ length: pending }, (_, i) => (
        <span
          key={`p${i}`}
          style={{
            display: 'inline-block',
            // Vary the widths so the placeholders read as words, not a progress bar.
            width: [30, 44, 24][i % 3],
            height: TYPE.screenText + 2,
            border: `1px solid ${withAlpha('#FFFFFF', 0.16 - i * 0.04)}`,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
};
