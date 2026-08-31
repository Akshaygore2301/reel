import React from 'react';
import { withAlpha } from '../brand/tokens';
import { MACHINE } from './geometry';
import { Rivet, Wire } from './Wire';

const rect = (x: number, y: number, w: number, h: number) =>
  `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;

/**
 * The shared emitter. Both paths are fed by this one machine — that is the point:
 * nothing about the source differs, only what happens downstream.
 *
 * The fan spins one step per emitted unit rather than continuously, so the
 * rotation reads as "one more token" instead of ambient motion.
 */
export const Machine: React.FC<{
  color: string;
  /** Monotonic count of units emitted; drives fan rotation. */
  emitted: number;
  /** Frames since the last emission, for the LCD flash. */
  sinceTick: number;
  /** Text on the little LCD — the unit currently being written. */
  lcdText: string;
  /** 1 while actively writing, lower once the machine has stopped. */
  lcdDim?: number;
  lcdFont: string;
}> = ({ color, emitted, sinceTick, lcdText, lcdDim = 1, lcdFont }) => {
  const { bodyX, bodyW, bodyY, bodyH, railY, railH, stackW, stackH, stackY, fan, lcd, baseY, baseH } =
    MACHINE;

  // 24 degrees per unit: enough to read as a step, not enough to look like a blur.
  const fanAngle = emitted * 24;
  const flash = Math.max(0, 1 - sinceTick / 2);

  return (
    <g>
      {/* Stack on top. */}
      <Wire d={rect(fan.cx + 48 - stackW / 2, stackY, stackW, stackH)} color={color} w={1.6} glow={2} />
      <Wire
        d={`M${fan.cx + 40},${stackY + stackH} L${fan.cx + 40},${railY} M${fan.cx + 56},${stackY + stackH} L${fan.cx + 56},${railY}`}
        color={color}
        w={1.4}
        glow={0}
        opacity={0.7}
      />

      {/* Top rail, three segments. */}
      <Wire d={rect(bodyX + 4, railY, bodyW - 8, railH)} color={color} w={1.6} glow={2} />
      {[0, 1, 2].map((i) => {
        const x = bodyX + 4 + ((bodyW - 8) / 3) * i;
        return (
          <Wire
            key={i}
            d={`M${x},${railY} L${x},${railY + railH}`}
            color={color}
            w={1.2}
            glow={0}
            opacity={0.6}
          />
        );
      })}
      {[bodyX + 20, bodyX + bodyW / 2, bodyX + bodyW - 20].map((x, i) => (
        <Rivet key={i} cx={x} cy={railY + railH} r={2.4} color={color} />
      ))}

      {/* Body. */}
      <path d={rect(bodyX, bodyY, bodyW, bodyH)} fill={withAlpha('#0A1017', 0.75)} />
      <Wire d={rect(bodyX, bodyY, bodyW, bodyH)} color={color} w={2.2} glow={3} />

      {/* Fan: hub plus eight blades, stepping once per emitted unit. */}
      <g transform={`rotate(${fanAngle} ${fan.cx} ${fan.cy})`}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={fan.cx}
              y1={fan.cy}
              x2={fan.cx + Math.cos(a) * fan.r}
              y2={fan.cy + Math.sin(a) * fan.r}
              stroke={color}
              strokeWidth={1.2}
              opacity={0.75}
            />
          );
        })}
      </g>
      <Wire
        d={`M${fan.cx - fan.r},${fan.cy} A${fan.r},${fan.r} 0 1 0 ${fan.cx + fan.r},${fan.cy} A${fan.r},${fan.r} 0 1 0 ${fan.cx - fan.r},${fan.cy}`}
        color={color}
        w={1.5}
        glow={2}
      />
      <circle cx={fan.cx} cy={fan.cy} r={2.6} fill={color} />

      {/* LCD showing the unit being written right now. */}
      <path d={rect(lcd.x, lcd.y, lcd.w, lcd.h)} fill="#04070A" />
      <Wire
        d={rect(lcd.x, lcd.y, lcd.w, lcd.h)}
        color="#FFFFFF"
        w={1.3}
        glow={2}
        opacity={(0.55 + flash * 0.45) * lcdDim}
      />
      <text
        x={lcd.x + lcd.w / 2}
        y={lcd.y + lcd.h / 2 + 4.5}
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily={lcdFont}
        fontSize={12.5}
        fontWeight={500}
        opacity={(0.6 + flash * 0.4) * lcdDim}
      >
        {lcdText}
      </text>

      {/* Base and the two ports the belts leave from. */}
      <Wire d={rect(bodyX + 10, baseY, bodyW - 20, baseH)} color={color} w={1.5} glow={0} opacity={0.75} />
      {[bodyX + 22, bodyX + bodyW - 52].map((x, i) => (
        <Wire key={i} d={rect(x, baseY + 3, 30, baseH - 6)} color={color} w={1.1} glow={0} opacity={0.5} />
      ))}
    </g>
  );
};
