import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel';
import { SCENES } from './scenes';
import { VIDEO } from './brand/tokens';
import { timelineFor } from './archetypes/registry';
import { FPS } from './timeline/core';

/**
 * One composition per scenes/*.json, id = slug.
 *
 * Duration comes from the scene's archetype timeline, not from here. A composition
 * whose length disagreed with its beat list would truncate the payoff cycle.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {SCENES.map((scene) => (
      <Composition
        key={scene.slug}
        id={scene.slug}
        component={Reel}
        durationInFrames={timelineFor(scene.stage).durationInFrames}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{ scene, audio: true }}
      />
    ))}
  </>
);
