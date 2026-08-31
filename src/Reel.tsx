import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { Frame } from './chrome/Frame';
import { Header } from './chrome/Header';
import { Footer } from './chrome/Footer';
import { SplitCompare } from './archetypes/SplitCompare';
import type { Scene } from './schema/scene';

/**
 * A whole reel: fixed chrome, one archetype on the stage, one procedurally
 * generated audio track.
 *
 * The audio WAV is built offline by scripts/build-audio.mjs from the same
 * timeline module the visuals read. If it is missing the video still renders
 * silently, which keeps `remotion studio` usable without running the build.
 */
export const Reel: React.FC<{ scene: Scene; audio?: boolean }> = ({ scene, audio = true }) => {
  return (
    <Frame>
      <Header scene={scene} />

      <AbsoluteFill>
        {scene.stage.kind === 'splitCompare' && <SplitCompare stage={scene.stage} />}
      </AbsoluteFill>

      <Footer scene={scene} />

      {audio && <Audio src={staticFile(`audio/${scene.slug}.wav`)} />}
    </Frame>
  );
};
