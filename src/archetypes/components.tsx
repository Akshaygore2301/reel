import type React from 'react';
import type { ArchetypeKind, Stage } from './registry';
import { FanOut } from './fanOut/FanOut';
import { Layers } from './layers/Layers';
import { Lifecycle } from './lifecycle/Lifecycle';
import { Pipeline } from './pipeline/Pipeline';
import { ScaleOut } from './scaleOut/ScaleOut';
import { SplitCompare } from './splitCompare/SplitCompare';

/**
 * The React side of the archetype registry. Kept apart from `registry.ts` so
 * bare Node in scripts/ never loads a component.
 */
export const COMPONENTS: {
  [K in ArchetypeKind]: React.FC<{ stage: Extract<Stage, { kind: K }> }>;
} = {
  splitCompare: SplitCompare,
  pipeline: Pipeline,
  scaleOut: ScaleOut,
  fanOut: FanOut,
  layers: Layers,
  lifecycle: Lifecycle,
};

/** Renders the component for `stage.kind`. */
export const StageView: React.FC<{ stage: Stage }> = ({ stage }) => {
  // Same correlated-union widening as `entryFor` in registry.ts.
  const Component = COMPONENTS[stage.kind] as React.FC<{ stage: Stage }>;
  return <Component stage={stage} />;
};
