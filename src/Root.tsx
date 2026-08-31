import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel';
import { SCENES } from './scenes';
import { VIDEO } from './brand/tokens';
import { DURATION_IN_FRAMES, FPS } from './timeline/beats';

/**
 * One composition per scenes/*.json, id = slug.
 *
 * Duration and fps come from the timeline module, not from here — a composition
 * whose length disagreed with the beat list would truncate the payoff cycle.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {SCENES.map((scene) => (
      <Composition
        key={scene.slug}
        id={scene.slug}
        component={Reel}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{ scene, audio: true }}
      />
    ))}
  </>
);
