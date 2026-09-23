/**
 * Every archetype the engine can render, keyed by `stage.kind`.
 *
 * Node-safe (no React): scripts/ and schema validation import this. The React
 * side has its own map in `components.tsx`, so bare Node never loads a
 * component.
 *
 * Adding an archetype: add its schema to `StageSchema` and its entry here, and
 * its component to `components.tsx`. The compiler flags the rest.
 */
import { z } from 'zod';
import type { Timeline } from '../timeline/core.ts';
import * as fanOut from './fanOut/schema.ts';
import { fanOutTimeline } from './fanOut/timeline.ts';
import * as layers from './layers/schema.ts';
import { layersTimeline } from './layers/timeline.ts';
import * as lifecycle from './lifecycle/schema.ts';
import { lifecycleTimeline } from './lifecycle/timeline.ts';
import * as pipeline from './pipeline/schema.ts';
import { pipelineTimeline } from './pipeline/timeline.ts';
import * as scaleOut from './scaleOut/schema.ts';
import { scaleOutTimeline } from './scaleOut/timeline.ts';
import * as splitCompare from './splitCompare/schema.ts';
import { splitCompareTimeline } from './splitCompare/timeline.ts';

export const StageSchema = z.discriminatedUnion('kind', [
  splitCompare.SplitCompareSchema,
  pipeline.PipelineSchema,
  scaleOut.ScaleOutSchema,
  fanOut.FanOutSchema,
  layers.LayersSchema,
  lifecycle.LifecycleSchema,
]);

export type Stage = z.infer<typeof StageSchema>;
export type ArchetypeKind = Stage['kind'];

/**
 * What an author (human or agent) needs to pick an archetype. `reel archetypes`
 * prints this; the tables in README.md and prompts/author-scene.md mirror it.
 */
export type ArchetypeMeta = {
  /** The single argument the archetype's diagram makes. */
  claim: string;
  fits: string[];
  /** When the claim would be a stretch. */
  avoid: string;
  /** Repo-relative path of the authoring guide. */
  guide: string;
  /** Slugs of scenes that use it well. */
  reference: string[];
  /** Frames worth a still before declaring a scene done. */
  checkFrames: number[];
};

type Entry<T> = {
  meta: ArchetypeMeta;
  /** Must be pure in `stage`: Studio, the renderer and scripts each build their own. */
  timeline(stage: T): Timeline;
  /** Rules a type cannot express. Throws with an author-facing message. */
  validate(stage: T): void;
  /** Budget lines printed by `npm run validate`. */
  describe(stage: T): string[];
};

export const ARCHETYPES: { [K in ArchetypeKind]: Entry<Extract<Stage, { kind: K }>> } = {
  splitCompare: {
    meta: {
      claim: 'The same work done two ways; one makes you wait for all of it before you get any of it.',
      fits: ['streaming vs buffering', 'cache hit vs cold read', 'pagination', 'incremental builds'],
      avoid: 'No natural pair, a win about correctness, or one path where the question is where the time goes.',
      guide: 'prompts/archetypes/splitCompare.md',
      reference: ['token-streaming', 'redis-cache-aside'],
      checkFrames: [245],
    },
    timeline: () => splitCompareTimeline,
    validate: splitCompare.validate,
    describe: splitCompare.describe,
  },
  pipeline: {
    meta: {
      claim: 'One path, and one stage in it eats the time. Fix that stage and the whole path shrinks.',
      fits: ['request lifecycle', 'cold starts', 'CI runs', 'query plans', 'page load waterfalls'],
      avoid: 'A comparison of two whole approaches, or a path where the time is spread evenly.',
      guide: 'prompts/archetypes/pipeline.md',
      reference: ['cold-start', 'db-index'],
      checkFrames: [250],
    },
    timeline: pipelineTimeline,
    validate: pipeline.validate,
    describe: pipeline.describe,
  },
  scaleOut: {
    meta: {
      claim: 'Capacity ran out. Growing the one box means downtime; adding a box does not.',
      fits: ['vertical vs horizontal scaling', 'bigger DB vs sharding', 'worker pools'],
      avoid: 'Speed per request, or an up side that genuinely resizes without downtime.',
      guide: 'prompts/archetypes/scaleOut.md',
      reference: ['scale-up-vs-out'],
      checkFrames: [200, 260],
    },
    timeline: () => scaleOutTimeline,
    validate: scaleOut.validate,
    describe: scaleOut.describe,
  },
  fanOut: {
    meta: {
      claim: 'Independent calls. Made in turn you wait for the sum; fanned out you wait only for the slowest.',
      fits: ['Promise.all / async fan-out', 'parallel API calls', 'scatter-gather', 'sharded test runs'],
      avoid: 'Calls that depend on each other (that is pipeline), or one call that dwarfs the rest.',
      guide: 'prompts/archetypes/fanOut.md',
      reference: ['promise-all'],
      checkFrames: [60, 250],
    },
    timeline: fanOutTimeline,
    validate: fanOut.validate,
    describe: fanOut.describe,
  },
  layers: {
    meta: {
      claim: 'A request falls through layers until one can answer; every layer that answers saves the trip below it.',
      fits: ['CDN in front of origin', 'cache in front of a database', 'CPU cache hierarchy', 'DNS resolver chain'],
      avoid: 'Two whole approaches side by side (that is splitCompare), or layers that are not faster than the ones below.',
      guide: 'prompts/archetypes/layers.md',
      reference: ['cdn-cache'],
      checkFrames: [66, 268],
    },
    timeline: layersTimeline,
    validate: layers.validate,
    describe: layers.describe,
  },
  lifecycle: {
    meta: {
      claim: 'A pooled resource has to come back. Skip the release and it parks in one state until the pool runs dry.',
      fits: ['connection leaks', 'TCP TIME_WAIT exhaustion', 'unclosed file descriptors', 'locks never released'],
      avoid: 'One slow step (that is pipeline), or running out of capacity with nothing leaking (that is scaleOut).',
      guide: 'prompts/archetypes/lifecycle.md',
      reference: ['connection-leak'],
      checkFrames: [72, 250],
    },
    timeline: lifecycleTimeline,
    validate: lifecycle.validate,
    describe: lifecycle.describe,
  },
};

// TypeScript cannot correlate `stage.kind` with the entry it selects, so the
// lookup is widened once here instead of at every call site.
const entryFor = (stage: Stage) => ARCHETYPES[stage.kind] as Entry<Stage>;

export const metaFor = (kind: ArchetypeKind): ArchetypeMeta => ARCHETYPES[kind].meta;
export const timelineFor = (stage: Stage): Timeline => entryFor(stage).timeline(stage);
export const validateStage = (stage: Stage) => entryFor(stage).validate(stage);
export const describeStage = (stage: Stage) => entryFor(stage).describe(stage);
