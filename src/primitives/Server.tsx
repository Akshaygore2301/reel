import React from 'react';
import { COLOR, withAlpha } from '../brand/tokens';
import { Rivet, Wire } from './Wire';

const rect = (x: number, y: number, w: number, h: number) =>
  `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;

/**
 * A rack server, drawn around its centre so it can grow in place.
 *
 * Rack slots with an LED each; LEDs light bottom-up with load, so a full box
 * reads as full without a number. A load bar runs along the foot. Offline, the
 * whole thing drops to a dashed ghost: present, but not serving.
 */
export const Server: React.FC<{
  cx: number;
  cy: number;
  w: number;
  h: number;
  color: string;
  /** 0..1 utilisation. */
  load: number;
  offline?: boolean;
  /** Per-arrival flash, 0..1. */
  flash?: number;
  opacity?: number;
}> = ({ cx, cy, w, h, color, load, offline = false, flash = 0, opacity = 1 }) => {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const slots = 4;
  const slotTop = y + 10;
  const slotH = (h - 34) / slots;
  const lit = Math.round(load * slots);
  const hot = load > 0.95;

  return (
    <g opacity={opacity}>
      <path d={rect(x, y, w, h)} fill={withAlpha('#0A1017', 0.8)} />
      <Wire
        d={rect(x, y, w, h)}
        color={color}
        w={2}
        glow={offline ? 0 : 3}
        opacity={offline ? 0.45 : 1}
        dash={offline ? '5 5' : undefined}
      />

      {Array.from({ length: slots }, (_, i) => {
        const sy = slotTop + slotH * i;
        const on = !offline && slots - i <= lit;
        return (
          <g key={i}>
            <Wire
              d={rect(x + 10, sy + 2, w - 20, slotH - 4)}
              color={color}
              w={1}
              glow={0}
              opacity={offline ? 0.2 : 0.45}
            />
            <Rivet
              cx={x + 18}
              cy={sy + slotH / 2}
              r={2.2}
              color={hot && on ? COLOR.ink : color}
              opacity={on ? 0.75 + 0.25 * flash : 0.15}
            />
          </g>
        );
      })}

      {/* Load bar along the foot. */}
      <Wire d={rect(x + 10, y + h - 16, w - 20, 6)} color={color} w={1} glow={0} opacity={0.4} />
      {load > 0 && (
        <path d={rect(x + 10, y + h - 16, (w - 20) * load, 6)} fill={withAlpha(color, hot ? 0.95 : 0.7)} />
      )}
    </g>
  );
};
