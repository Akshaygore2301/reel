import React from 'react';
import { FONT } from '../../brand/fonts';
import { COLOR, VIDEO } from '../../brand/tokens';
import { useTimelineState } from '../../timeline/context';
import { TICK_STRIDE, TIMING, splitCompareTimeline } from './timeline';
import {
  CAGE_LABEL,
  COUNTER,
  PANEL,
  PANEL_TITLE,
  STAT,
  SOURCE_LABEL,
  faceBox,
  mirrorX,
} from '../../primitives/geometry';
import { BufferCage } from '../../primitives/BufferCage';
import { Conveyor } from '../../primitives/Conveyor';
import { Counter } from '../../primitives/Counter';
import { LabelBlock, TitleBlock } from '../../primitives/Labels';
import { Machine } from '../../primitives/Machine';
import { Panel } from '../../primitives/Panel';
import { StatDelta } from '../../primitives/StatDelta';
import { Timer } from '../../primitives/Timer';
import { TokenText } from '../../primitives/TokenText';
import type { SplitCompare as SplitCompareStage } from './schema';

/** Centre of the slow panel's title; the fast one mirrors it. */
const TITLE_CX = (PANEL.outerTopX + PANEL.innerX) / 2;

/** Frames a unit takes to travel a belt end to end. ~4 units visible in transit. */
const TRAVEL = 12;

/**
 * One source, two downstream paths that differ only in whether they buffer.
 *
 * Every animated value below is derived from `stateAt(frame)`. Nothing here keeps
 * its own clock, so the picture cannot drift from the audio built off the same
 * timeline.
 */
export const SplitCompare: React.FC<{ stage: SplitCompareStage }> = ({ stage }) => {
  const s = useTimelineState(splitCompareTimeline);

  const words = React.useMemo(
    () => stage.payloads.map((p) => p.trim().split(/\s+/)),
    [stage.payloads],
  );
  const cycleWords = words[Math.min(s.cycle, words.length - 1)];

  // Units in transit: unit k left the machine at local frame k*TICK_STRIDE.
  const chipTs: number[] = [];
  for (let k = 0; k < TIMING.tokens; k++) {
    const t = (s.local - k * TICK_STRIDE) / TRAVEL;
    if (t >= 0 && t <= 1) chipTs.push(t);
  }

  // Slats scroll while units are moving and stop when the machine does.
  const beltPhase = s.phase === 'emitting' ? (s.local / TICK_STRIDE) * 0.55 : 0;

  const tickFlash = Math.max(0, 1 - s.sinceTick / 2);
  const fade = 1 - s.resetProgress;

  // The LCD keeps showing the last word it wrote after emission stops — an empty
  // display reads as "broken", a held one as "finished, waiting on the transport".
  const lcdText = cycleWords[Math.max(0, s.fastTokens - 1)] ?? '';
  const lcdDim = s.phase === 'emitting' ? 1 : 0.45;

  const rightFace = faceBox('right');
  const leftFace = faceBox('left');

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      <svg
        width={VIDEO.width}
        height={VIDEO.height}
        viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Machine
          color={COLOR.machine}
          emitted={s.fastTokens}
          sinceTick={s.sinceTick}
          lcdText={lcdText}
          lcdDim={lcdDim}
          lcdFont={FONT.mono}
        />

        {/* Slow path: belt into the cage, and the cage holding everything back. */}
        <Conveyor side="left" color={COLOR.slow} phase={beltPhase} chipTs={chipTs} />
        <BufferCage
          color={COLOR.slow}
          held={s.buffered}
          capacity={TIMING.tokens}
          dump={s.dumpProgress}
        />

        {/* Fast path: same belt, nothing in the way. */}
        <Conveyor side="right" color={COLOR.fast} phase={beltPhase} chipTs={chipTs} />

        <Panel side="left" color={COLOR.slow} />
        <Panel side="right" color={COLOR.fast} />
      </svg>

      {/* ---- counters ---- */}
      <Counter
        cx={COUNTER.leftCx}
        y={COUNTER.y}
        label={stage.counterLabel}
        value={s.slowTokens}
        color={COLOR.slow}
        flash={s.sinceDump >= 0 && s.sinceDump < 6 ? 1 - s.sinceDump / 6 : 0}
        align="left"
      />
      <Counter
        cx={mirrorX(COUNTER.leftCx)}
        y={COUNTER.y}
        label={stage.counterLabel}
        value={s.fastTokens}
        color={COLOR.fast}
        flash={tickFlash}
        align="right"
      />

      {/* ---- labels ---- */}
      <LabelBlock
        cx={SOURCE_LABEL.cx}
        y={SOURCE_LABEL.y}
        label={stage.source.label}
        sub={stage.source.sub}
        color={COLOR.machine}
      />
      <LabelBlock
        cx={CAGE_LABEL.cx}
        y={CAGE_LABEL.y}
        label={stage.buffer.label}
        sub={s.dumpProgress > 0.35 ? stage.buffer.subOpen : stage.buffer.sub}
        color={COLOR.slow}
      />

      {/* ---- slow screen: a spinner and a clock, nothing else until the dump ---- */}
      {s.slowTokens === 0 ? (
        <Timer
          cx={(leftFace.left + leftFace.width / 2) | 0}
          cy={leftFace.top + leftFace.height / 2 + 4}
          seconds={s.waitSeconds}
          label={stage.slow.waitLabel}
          color={COLOR.slow}
          step={s.fastTokens}
        />
      ) : (
        <TokenText
          words={cycleWords}
          revealed={cycleWords.length}
          lookahead={false}
          color={COLOR.slow}
          box={leftFace}
        />
      )}

      {/* ---- fast screen: words as they are made ---- */}
      <TokenText
        words={cycleWords}
        revealed={s.fastTokens}
        flash={tickFlash}
        color={COLOR.fast}
        box={rightFace}
      />

      <StatDelta stat={stage.stat} reveal={s.statReveal} box={STAT} />

      {/* ---- panel titles ---- */}
      <TitleBlock cx={TITLE_CX} y={PANEL_TITLE.y} title={stage.slow.title} sub={stage.slow.sub} color={COLOR.slow} />
      <TitleBlock
        cx={mirrorX(TITLE_CX)}
        y={PANEL_TITLE.y}
        title={stage.fast.title}
        sub={stage.fast.sub}
        color={COLOR.fast}
      />
    </div>
  );
};
