import React from 'react';
import { withAlpha } from '../brand/tokens';
import { PANEL, panelQuad, toPath, type Side } from './geometry';
import { Rivet, Wire } from './Wire';

/**
 * A monitor: trapezoid body, double-line bezel, two splayed legs with feet.
 *
 * The screen face is drawn here but its CONTENTS are HTML laid over the SVG (see
 * faceBox in geometry.ts) — SVG text can't do the tabular-figure and
 * letter-spacing control the labels need.
 */
export const Panel: React.FC<{ side: Side; color: string; glow?: number }> = ({
  side,
  color,
  glow = 1,
}) => {
  const outer = panelQuad(side);
  const inner = panelQuad(side, PANEL.bezel);

  // Legs hang from the bottom edge, splaying slightly outward as they drop.
  const bl = outer[3];
  const br = outer[2];
  const legTopA = { x: bl.x + (side === 'left' ? PANEL.legInset : -PANEL.legInset), y: bl.y };
  const legTopB = { x: br.x + (side === 'left' ? -PANEL.legInset : PANEL.legInset), y: br.y };
  const splay = side === 'left' ? -4 : 4;

  const legs = [
    { top: legTopA, foot: { x: legTopA.x + splay, y: legTopA.y + PANEL.legDrop } },
    { top: legTopB, foot: { x: legTopB.x + splay * 0.4, y: legTopB.y + PANEL.legDrop } },
  ];

  return (
    <g>
      {/* Screen face: darker than the ground so text reads as backlit. */}
      <path d={toPath(inner)} fill="#05090D" />

      <Wire d={toPath(outer)} color={color} w={2.4} glow={3.4 * glow} />
      <Wire d={toPath(inner)} color={color} w={1.2} glow={0} opacity={0.72} />

      {/* Corner rivets. */}
      {outer.map((p, i) => (
        <Rivet key={i} cx={p.x} cy={p.y} r={2.6} color={color} />
      ))}

      {/* A rail just under the bottom edge, then the legs. */}
      <Wire
        d={`M${bl.x + (side === 'left' ? 6 : -6)},${bl.y + 7} L${br.x + (side === 'left' ? -6 : 6)},${br.y + 7}`}
        color={color}
        w={1.6}
        glow={0}
        opacity={0.6}
      />

      {legs.map((l, i) => (
        <g key={i}>
          <Wire d={`M${l.top.x},${l.top.y} L${l.foot.x},${l.foot.y}`} color={color} w={1.8} glow={2} />
          <Rivet cx={l.foot.x} cy={l.foot.y} r={PANEL.footR} color={color} />
        </g>
      ))}

      {/* Faint inner scanline band, sells the screen without drawing attention. */}
      <path
        d={toPath(panelQuad(side, PANEL.bezel + 4))}
        fill="none"
        stroke={withAlpha(color, 0.16)}
        strokeWidth={1}
      />
    </g>
  );
};
