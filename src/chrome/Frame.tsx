import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLOR, withAlpha } from '../brand/tokens';

/**
 * The ground. A flat fill would band badly under H.264 at 595kbps, so there is a
 * very wide radial lift behind the stage plus a faint dither texture. Both are
 * static — nothing here animates, on purpose: the chrome has to feel like a
 * printed page the diagram is drawn on.
 */
export const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.ground }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 60% at 50% 44%, ${withAlpha('#16212E', 0.55)} 0%, transparent 70%)`,
        }}
      />
      {/* Break up the flat dark so the encoder has something to hold on to. */}
      <AbsoluteFill
        style={{
          opacity: 0.035,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='1' height='1' fill='%23fff'/%3E%3Crect x='2' y='2' width='1' height='1' fill='%23fff'/%3E%3C/svg%3E\")",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};
