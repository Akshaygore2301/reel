import React from 'react';
import { withAlpha } from '../brand/tokens';
import { CAGE } from './geometry';
import { Rivet, Wire } from './Wire';

const rect = (x: number, y: number, w: number, h: number) =>
  `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;

/**
 * The cage on the slow path. Units pile up inside it, stacked bottom-up, and the
 * viewer can see work sitting there finished and undelivered — which is the whole
 * argument of a buffering-vs-streaming reel.
 *
 * At the dump, the stack empties and the units scatter out of the open door.
 */
export const BufferCage: React.FC<{
  color: string;
  /** Units currently held, 0..capacity. */
  held: number;
  capacity: number;
  /** 0..1 dump animation. 0 = shut and filling, 1 = fully emptied. */
  dump: number;
}> = ({ color, held, capacity, dump }) => {
  const { x, y, w, h, rows } = CAGE;

  const level = Math.min(1, held / capacity) * (1 - dump);
  const filled = Math.round(level * rows);
  const rowH = (h - 12) / rows;

  // The door lifts as it dumps.
  const doorLift = dump * (h - 14);

  return (
    <g>
      {/* While it is holding units the cage is a solid object the belt runs
          behind; once emptied it goes near-transparent, so an empty cage reads as
          an empty cage and not as a hole punched in the diagram. */}
      <path d={rect(x, y, w, h)} fill="#080D13" opacity={0.62 * (1 - dump * 0.75)} />
      <Wire d={rect(x, y, w, h)} color={color} w={2.2} glow={3} />

      {/* Uprights. */}
      {[0.33, 0.66].map((f, i) => (
        <Wire
          key={i}
          d={`M${x + w * f},${y} L${x + w * f},${y + h}`}
          color={color}
          w={1.2}
          glow={0}
          opacity={0.45}
        />
      ))}

      {/*
        Stacked units, filling bottom-up. Each row is offset and shortened a
        little so the pile reads as discrete items stacked by hand rather than a
        progress bar — the same reason the words on screen are chips and not a
        paragraph. Offsets are a fixed function of the row index, so a given fill
        level always draws identically.
      */}
      {Array.from({ length: filled }, (_, i) => {
        const ry = y + h - 6 - (i + 1) * rowH;
        const jog = ((i * 7) % 3) * 4;
        const short = ((i * 5) % 4) * 5;
        return (
          <rect
            key={i}
            x={x + 7 + jog}
            y={ry}
            width={w - 14 - jog - short}
            height={rowH - 1.8}
            fill={withAlpha(color, 0.22)}
            stroke={color}
            strokeWidth={1}
            opacity={0.92}
          />
        );
      })}

      {/* Door on the outfeed side, lifting during the dump. */}
      <g transform={`translate(0,${-doorLift})`}>
        <Wire
          d={rect(x + w - 16, y + 6, 12, h - 12)}
          color={color}
          w={1.4}
          glow={dump > 0 ? 3 : 0}
          opacity={0.85}
        />
      </g>

      {/* Units bursting out once the door is up. */}
      {dump > 0 &&
        Array.from({ length: 7 }, (_, i) => {
          const spread = dump * (18 + i * 9);
          const drop = dump * dump * (10 + i * 4);
          const o = Math.max(0, 1 - dump * 1.1);
          const cx = x + w + spread;
          const cy = y + h - 14 + drop;
          return (
            <rect
              key={i}
              x={cx - 9}
              y={cy - 5}
              width={18}
              height={9}
              transform={`rotate(${i * 17 * dump} ${cx} ${cy})`}
              fill={withAlpha(color, 0.22)}
              stroke={color}
              strokeWidth={1.1}
              opacity={o}
            />
          );
        })}

      {[
        { cx: x, cy: y },
        { cx: x + w, cy: y },
        { cx: x, cy: y + h },
        { cx: x + w, cy: y + h },
      ].map((p, i) => (
        <Rivet key={i} {...p} r={2.4} color={color} />
      ))}
    </g>
  );
};
