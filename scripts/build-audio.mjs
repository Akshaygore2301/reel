/**
 * Builds public/audio/<slug>.wav from each scene's archetype timeline.
 *
 * Run: node --experimental-strip-types scripts/build-audio.mjs [slug ...]
 *
 * This imports the SAME timeline module the archetype's React component reads.
 * There is no second list of timings anywhere: retime an archetype and both the
 * picture and this WAV move together. Each scene gets its own track: some
 * archetypes' rhythms depend on content (a pipeline's handoffs land where its
 * stage weights put them), so two scenes of one archetype need not match.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { FPS } from '../src/timeline/core.ts';
import { timelineFor } from '../src/archetypes/registry.ts';
import { validateScene } from '../src/schema/scene.ts';
import { SAMPLE_RATE, renderSound, softClip, toWav } from '../src/audio/synth.ts';
import { ROOT, selectScenes } from './lib/scenes.mjs';

/** Extra tail so the final stinger's ring is not cut off mid-decay. */
const TAIL_SECONDS = 0.4;

function buildTrack(timeline) {
  const beats = timeline.buildBeats();
  const duration = timeline.durationInFrames;
  const total = Math.ceil((duration / FPS + TAIL_SECONDS) * SAMPLE_RATE);
  const buf = new Float32Array(total);

  let placed = 0;
  let dropped = 0;

  for (const beat of beats) {
    const at = Math.round((beat.frame / FPS) * SAMPLE_RATE);
    /*
     * Keep only beats that START inside the video. Two kinds get dropped:
     * negative ones, because a reel opens mid-phrase; and ones past the last
     * frame, because timelines deliberately run a cycle long. The TAIL_SECONDS
     * of buffer exists so the last KEPT sound can ring out, not to admit sounds
     * the viewer will never reach.
     */
    if (at < 0 || beat.frame >= duration) {
      dropped++;
      continue;
    }
    // Seed from the frame so each sound's noise is unique but reproducible.
    renderSound(buf, beat.kind, at, beat.gain, beat.frame * 2654435761 + 1);
    placed++;
  }

  softClip(buf);

  let peak = 0;
  for (const s of buf) peak = Math.max(peak, Math.abs(s));

  const kinds = beats.reduce((acc, b) => ({ ...acc, [b.kind]: (acc[b.kind] ?? 0) + 1 }), {});
  console.log(
    `  ${placed} sounds placed, ${dropped} outside the render window` +
      `\n  ${(buf.length / SAMPLE_RATE).toFixed(2)}s @ ${SAMPLE_RATE}Hz mono, peak ${peak.toFixed(3)}` +
      `\n  ${Object.entries(kinds)
        .map(([k, v]) => `${k}:${v}`)
        .join('  ')}`,
  );

  return toWav(buf);
}

mkdirSync(join(ROOT, 'public', 'audio'), { recursive: true });

for (const { raw } of selectScenes()) {
  const scene = validateScene(raw);
  console.log(`\n  ${scene.slug} (${scene.stage.kind})`);
  const wav = buildTrack(timelineFor(scene.stage));
  writeFileSync(join(ROOT, 'public', 'audio', `${scene.slug}.wav`), wav);
  console.log(`  wrote public/audio/${scene.slug}.wav`);
}
console.log('');
