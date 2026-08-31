/**
 * Builds public/audio/<slug>.wav from the shared timeline.
 *
 * Run: node --experimental-strip-types scripts/build-audio.mjs [slug ...]
 *
 * This imports the SAME timeline/beats.ts the React components read. There is no
 * second list of timings anywhere — retime the cycle in beats.ts and both the
 * picture and this WAV move together.
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBeats, DURATION_IN_FRAMES, FPS } from '../src/timeline/beats.ts';
import { SAMPLE_RATE, renderSound, softClip, toWav } from '../src/audio/synth.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Extra tail so the final stinger's ring is not cut off mid-decay. */
const TAIL_SECONDS = 0.4;

function buildTrack() {
  const beats = buildBeats();
  const total = Math.ceil((DURATION_IN_FRAMES / FPS + TAIL_SECONDS) * SAMPLE_RATE);
  const buf = new Float32Array(total);

  let placed = 0;
  let dropped = 0;

  for (const beat of beats) {
    const at = Math.round((beat.frame / FPS) * SAMPLE_RATE);
    /*
     * Keep only beats that START inside the video. Two kinds get dropped:
     * negative ones, because the reel opens mid-phrase; and ones past the last
     * frame, because buildBeats deliberately runs a cycle long. The TAIL_SECONDS
     * of buffer exists so the last KEPT sound can ring out, not to admit sounds
     * the viewer will never reach.
     */
    if (at < 0 || beat.frame >= DURATION_IN_FRAMES) {
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

  return { buf, placed, dropped, peak, beats };
}

const slugs =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : readdirSync(join(ROOT, 'scenes'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(ROOT, 'scenes', f), 'utf8')).slug);

const { buf, placed, dropped, peak, beats } = buildTrack();
const wav = toWav(buf);

mkdirSync(join(ROOT, 'public', 'audio'), { recursive: true });

for (const slug of slugs) {
  const out = join(ROOT, 'public', 'audio', `${slug}.wav`);
  writeFileSync(out, wav);
  console.log(`  wrote public/audio/${slug}.wav`);
}

const kinds = beats.reduce((acc, b) => ({ ...acc, [b.kind]: (acc[b.kind] ?? 0) + 1 }), {});
console.log(
  `\n  ${placed} sounds placed, ${dropped} outside the render window` +
    `\n  ${(buf.length / SAMPLE_RATE).toFixed(2)}s @ ${SAMPLE_RATE}Hz mono, peak ${peak.toFixed(3)}` +
    `\n  ${Object.entries(kinds)
      .map(([k, v]) => `${k}:${v}`)
      .join('  ')}`,
);
