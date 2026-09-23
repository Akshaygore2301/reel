import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { BaseState, Timeline } from './core';

/**
 * THE ONE RULE: no component derives an animation from `useCurrentFrame()` on
 * its own. It asks its archetype's timeline, through `useTimelineState`. The
 * moment two places compute time independently they drift, and drift is exactly
 * what this format cannot hide when clicks arrive ten a second.
 *
 * `Reel` provides the scene's timeline here, so shared chrome can read the
 * `BaseState` fields without knowing which archetype is on the stage.
 */
const TimelineContext = React.createContext<Timeline | null>(null);

export const TimelineProvider: React.FC<{ timeline: Timeline; children: React.ReactNode }> = ({
  timeline,
  children,
}) => <TimelineContext.Provider value={timeline}>{children}</TimelineContext.Provider>;

export function useTimeline(): Timeline {
  const t = React.useContext(TimelineContext);
  if (!t) throw new Error('useTimeline() outside <TimelineProvider>');
  return t;
}

/** The state of `timeline` at the current frame. */
export function useTimelineState<S extends BaseState>(timeline: Timeline<S>): S {
  return timeline.stateAt(useCurrentFrame());
}
