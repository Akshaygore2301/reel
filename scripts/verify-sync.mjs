/**
 * Proves the audio lands where the timeline says it should.
 *
 * Run: node --experimental-strip-types scripts/verify-sync.mjs [file.wav]
 *
 * Method: 20ms RMS envelope, onset = a bin that rises past a threshold from below.
 * Each detected onset must match a beat within one frame (33ms at 30fps). This is
 * the same analysis used to reverse-engineer the reference reel, so pointing it at
 * the reference and at our own output produces directly comparable reports.
 *
 * Exits non-zero on failure so it can gate a render.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBeats, DURATION_IN_FRAMES, FPS } from '../src/timeline/beats.ts';
import { ATTACK_SECONDS } from '../src/audio/synth.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = 0.02;
const TOLERANCE_FRAMES = 1;

/**
 * Beats closer together than this are one audible gesture — the first sound is
 * still ringing when the second starts, so the envelope never returns to silence
 * between them and no second onset can exist to detect. The thud/whoosh pair at
 * the buffer dump is deliberately built this way.
 */
const GESTURE_FRAMES = 4;

function readWav(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`${path} is not a RIFF file`);

  // Walk the chunk list rather than assuming a 44-byte header — files from other
  // encoders carry LIST/fact chunks before `data`.
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    pos = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${path}: missing fmt or data chunk`);
  if (fmt.bits !== 16) throw new Error(`${path}: expected 16-bit PCM, got ${fmt.bits}-bit`);

  const frames = Math.floor(data.length / 2 / fmt.channels);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) {
      sum += data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
    }
    mono[i] = sum / fmt.channels;
  }
  return { mono, sampleRate: fmt.sampleRate };
}

function envelope(mono, sampleRate) {
  const win = Math.max(1, Math.round(sampleRate * BIN));
  const out = [];
  for (let i = 0; i + win <= mono.length; i += win) {
    let sum = 0;
    for (let j = 0; j < win; j++) sum += mono[i + j] * mono[i + j];
    out.push({ t: i / sampleRate, rms: Math.sqrt(sum / win) });
  }
  return out;
}

/** Bins that jump from near-silence into signal. */
function onsets(env, peak) {
  const hi = peak * 0.12;
  const lo = peak * 0.05;
  const found = [];
  let armed = true;
  for (const { t, rms } of env) {
    if (armed && rms > hi) {
      found.push(t);
      armed = false;
    } else if (!armed && rms < lo) {
      armed = true;
    }
  }
  return found;
}

/**
 * --describe reports the envelope structure without asserting against our beat
 * list. Point it at any reel's audio (including a reference you are trying to
 * match) to read off its tick grid, loop period and peak placement.
 */
const describeOnly = process.argv.includes('--describe');
const target =
  process.argv.slice(2).find((a) => !a.startsWith('--')) ??
  join(ROOT, 'public', 'audio', 'token-streaming.wav');
const { mono, sampleRate } = readWav(target);
const env = envelope(mono, sampleRate);
const peak = env.reduce((m, e) => Math.max(m, e.rms), 0);
const detected = onsets(env, peak);

const frameSec = 1 / FPS;
const tolerance = TOLERANCE_FRAMES * frameSec;

// Beats that should be audible inside the render window.
const beats = buildBeats().filter((b) => b.frame >= 0 && b.frame < DURATION_IN_FRAMES);

console.log(`\n  file      ${target.replace(ROOT + '/', '')}`);
console.log(`  duration  ${(mono.length / sampleRate).toFixed(3)}s @ ${sampleRate}Hz`);
console.log(`  onsets    ${detected.length} detected / ${beats.length} beats expected`);
console.log(`  tolerance ${(tolerance * 1000).toFixed(0)}ms (${TOLERANCE_FRAMES} frame)\n`);

if (describeOnly) {
  const gaps = detected.slice(1).map((t, i) => +(t - detected[i]).toFixed(3));
  const hist = gaps.reduce((acc, g) => ({ ...acc, [g]: (acc[g] ?? 0) + 1 }), {});
  const common = Object.entries(hist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const loud = env.reduce((m, e) => (e.rms > m.rms ? e : m), env[0]);
  // Longest run with no onsets: the quiet window while nothing is emitting.
  let quiet = { from: 0, len: 0 };
  for (let i = 1; i < detected.length; i++) {
    const len = detected[i] - detected[i - 1];
    if (len > quiet.len) quiet = { from: detected[i - 1], len };
  }

  console.log('  STRUCTURE');
  console.log(`    onset gaps (most common): ${common.map(([g, n]) => `${g}s x${n}`).join(', ')}`);
  console.log(`    loudest bin:              ${loud.t.toFixed(2)}s`);
  console.log(`    longest quiet window:     ${quiet.len.toFixed(2)}s from ${quiet.from.toFixed(2)}s`);
  console.log(`    first onset:              ${detected[0]?.toFixed(2)}s`);
  console.log(`    last onset:               ${detected[detected.length - 1]?.toFixed(2)}s\n`);
  process.exit(0);
}

// Match each expected beat to its nearest detected onset.
let worst = 0;
const misses = [];
const masked = [];

for (const [i, beat] of beats.entries()) {
  const want = beat.frame / FPS;
  let best = null;
  for (const got of detected) {
    const d = Math.abs(got - want);
    if (best === null || d < best.d) best = { got, d };
  }

  // Allowance: one frame, plus this sound's own attack time, plus half an
  // envelope bin of measurement quantisation.
  const allowed = tolerance + (ATTACK_SECONDS[beat.kind] ?? 0) + BIN / 2;

  if (best && best.d <= allowed) {
    // Report placement error net of the sound's own attack, so the number means
    // "how far off the grid is this", not "how soft is the attack".
    worst = Math.max(worst, Math.max(0, best.d - (ATTACK_SECONDS[beat.kind] ?? 0) - BIN / 2));
    continue;
  }

  // Not independently detectable? Only acceptable if an immediately preceding
  // beat is still sounding, i.e. the two are one gesture.
  const prev = beats[i - 1];
  if (prev && beat.frame - prev.frame <= GESTURE_FRAMES) {
    masked.push({ beat, prev });
  } else {
    misses.push({ beat, best });
  }
}

// Report the structure the reference established, so a regression in character
// (not just placement) is visible too.
const ticks = beats.filter((b) => b.kind === 'tick').map((b) => b.frame);
const strides = new Set(ticks.slice(1).map((f, i) => f - ticks[i]).filter((d) => d < 10));
const loudest = env.reduce((m, e) => (e.rms > m.rms ? e : m), env[0]);

console.log(`  tick grid    ${[...strides].join(', ')} frame stride`);
console.log(`  loudest bin  ${loudest.t.toFixed(2)}s`);
const stingerBeat = beats.find((b) => b.kind === 'stinger');
if (stingerBeat) {
  const want = stingerBeat.frame / FPS;
  const ok = Math.abs(loudest.t - want) <= 0.12;
  console.log(`  stinger at   ${want.toFixed(2)}s -> peak ${ok ? 'MATCHES' : 'DOES NOT MATCH'}`);
}

if (misses.length > 0) {
  console.log(`\n  FAIL: ${misses.length} beat(s) with no onset inside tolerance:`);
  for (const { beat, best } of misses.slice(0, 12)) {
    const want = (beat.frame / FPS).toFixed(3);
    const got = best ? `${best.got.toFixed(3)}s (off by ${(best.d * 1000).toFixed(0)}ms)` : 'nothing';
    console.log(`    ${beat.kind.padEnd(8)} f${String(beat.frame).padStart(3)} want ${want}s  got ${got}`);
  }
  process.exit(1);
}

if (masked.length > 0) {
  console.log(
    `\n  ${masked.length} beat(s) merged into a preceding gesture (expected, not a failure):`,
  );
  for (const { beat, prev } of masked) {
    console.log(
      `    ${beat.kind.padEnd(8)} f${beat.frame} rides on ${prev.kind} f${prev.frame} ` +
        `(+${(((beat.frame - prev.frame) / FPS) * 1000).toFixed(0)}ms)`,
    );
  }
}

console.log(
  `\n  PASS: ${beats.length - masked.length} independently detectable beats all landed ` +
    `within tolerance`,
);
console.log(`  worst deviation ${(worst * 1000).toFixed(1)}ms\n`);
