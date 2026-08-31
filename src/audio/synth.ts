/**
 * Procedural sound design. Six generators, no samples, no dependencies.
 *
 * Every sound is written into a shared Float32 buffer at an offset derived from a
 * beat's frame number, so a sound lands on the exact sample the picture changes.
 * That is the entire reason this is synthesised rather than sourced: a library
 * click placed by hand is within a frame or two, and a frame or two is precisely
 * the error the format cannot hide when clicks come ten a second.
 *
 * ---------------------------------------------------------------------------
 * CONSTRAINT: importable by bare Node via `--experimental-strip-types`, same as
 * timeline/beats.ts. Zero imports, type-only annotations.
 * ---------------------------------------------------------------------------
 */

export const SAMPLE_RATE = 48000;

/**
 * Deterministic noise. Math.random() is unavailable in this pipeline and would be
 * wrong anyway: two renders of the same scene must produce byte-identical audio,
 * or the sync verification test can't mean anything.
 */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

type Ctx = { buf: Float32Array; at: number; gain: number; seed: number };

const dur = (seconds: number) => Math.round(seconds * SAMPLE_RATE);

/** Write `n` samples through `f`, mixing additively and skipping out-of-range. */
function write(ctx: Ctx, n: number, f: (t: number, i: number) => number) {
  const { buf, at, gain } = ctx;
  for (let i = 0; i < n; i++) {
    const j = at + i;
    if (j < 0 || j >= buf.length) continue;
    buf[j] += f(i / SAMPLE_RATE, i) * gain;
  }
}

const expDecay = (t: number, tau: number) => Math.exp(-t / tau);
const sine = (t: number, hz: number) => Math.sin(2 * Math.PI * hz * t);

/**
 * One emitted unit. 40ms: a short high sine body plus a filtered noise transient
 * for the "mechanical" edge. Quiet and dry — at ten per second anything with a
 * tail turns into a wash.
 */
function tick(ctx: Ctx) {
  const n = dur(0.04);
  const rng = makeRng(ctx.seed);
  let lp = 0;
  write(ctx, n, (t) => {
    const env = expDecay(t, 0.008);
    const body = sine(t, 2200) * 0.5 + sine(t, 3300) * 0.18;
    // One-pole highpass-ish noise: raw noise minus its own lowpass.
    const raw = rng();
    lp += (raw - lp) * 0.35;
    const edge = (raw - lp) * 0.55;
    return (body + edge) * env * 0.5;
  });
}

/** The buffer unlocking. 180ms, 70Hz with a downward pitch sweep. Felt, not heard. */
function thud(ctx: Ctx) {
  const n = dur(0.18);
  write(ctx, n, (t) => {
    const env = expDecay(t, 0.055);
    const hz = 78 - 34 * (t / 0.18);
    return (sine(t, hz) * 0.9 + sine(t, hz * 2) * 0.12) * env;
  });
}

/**
 * The dump. 280ms of noise through a lowpass whose cutoff sweeps open then shut,
 * which is what gives it the "whoomph" contour rather than a flat hiss.
 */
function whoosh(ctx: Ctx) {
  const n = dur(0.28);
  const rng = makeRng(ctx.seed + 7);
  let lp = 0;
  let lp2 = 0;
  write(ctx, n, (t) => {
    const p = t / 0.28;
    // Attack fast, release slow.
    const env = Math.min(1, p / 0.08) * Math.pow(1 - p, 1.7);
    // Cutoff rises through the first third, then closes.
    const k = 0.02 + 0.22 * Math.sin(Math.min(1, p * 1.6) * Math.PI);
    const raw = rng();
    lp += (raw - lp) * k;
    lp2 += (lp - lp2) * k;
    return (lp2 * 3.2 + sine(t, 120 - 60 * p) * 0.22) * env;
  });
}

/** A soft confirmation on the point landing. 140ms, two tones a fifth apart. */
function accent(ctx: Ctx) {
  const n = dur(0.14);
  write(ctx, n, (t) => {
    const env = expDecay(t, 0.035);
    return (sine(t, 880) * 0.5 + sine(t, 1320) * 0.3) * env * 0.6;
  });
}

/** The reset sweep. 150ms of noise and pitch climbing together. */
function riser(ctx: Ctx) {
  const n = dur(0.15);
  const rng = makeRng(ctx.seed + 13);
  let lp = 0;
  write(ctx, n, (t) => {
    const p = t / 0.15;
    const env = Math.pow(p, 1.2) * (1 - Math.pow(p, 6));
    const k = 0.04 + 0.3 * p;
    lp += (rng() - lp) * k;
    return (lp * 1.6 + sine(t, 300 + 900 * p) * 0.3) * env;
  });
}

/**
 * The payoff. 220ms: a two-note chord with a noise transient on the front. The
 * loudest thing in the reel, and the only sound that gets to ring.
 */
function stinger(ctx: Ctx) {
  const n = dur(0.22);
  const rng = makeRng(ctx.seed + 29);
  let lp = 0;
  write(ctx, n, (t) => {
    const env = expDecay(t, 0.07);
    const transient = expDecay(t, 0.006);
    lp += (rng() - lp) * 0.4;
    const chord = sine(t, 587.33) * 0.5 + sine(t, 880) * 0.34 + sine(t, 1174.66) * 0.16;
    return chord * env * 0.85 + lp * transient * 0.9;
  });
}

const GENERATORS = { tick, thud, whoosh, accent, riser, stinger } as const;

export type SynthKind = keyof typeof GENERATORS;

/**
 * Per-kind level trim.
 *
 * CALIBRATED, not guessed. A 40ms click and a 180ms sine at the same peak
 * amplitude have wildly different RMS, so matching beat gains alone produced a mix
 * where the thud was louder than the payoff stinger — which both sounded wrong and
 * masked the quiet ramp-in ticks under the onset threshold.
 *
 * These values make the measured 20ms-RMS envelope match the reference reel's
 * relative levels (tick .48, thud .58, whoosh .86, accent .62, riser .39,
 * stinger 1.00). If you change a generator's internals, re-measure: render each
 * kind in isolation at gain 1.0, take its peak 20ms RMS, and rescale so the ratios
 * hold again.
 */
const LEVEL: Record<SynthKind, number> = {
  tick: 1.517,
  thud: 0.503,
  whoosh: 0.71,
  accent: 1.44,
  riser: 1.123,
  stinger: 0.8,
};

/**
 * How long each sound takes to cross an onset threshold, MEASURED by rendering
 * each kind in isolation at its beat gain and finding the first 20ms bin above
 * the detector's threshold. verify-sync.mjs adds these to its tolerance, otherwise
 * a correctly-placed swell reads as late.
 *
 * Only the riser is not a transient — that is what makes it a riser.
 */
export const ATTACK_SECONDS: Record<SynthKind, number> = {
  tick: 0,
  thud: 0,
  accent: 0,
  stinger: 0,
  whoosh: 0,
  riser: 0.04,
};

/** Render one sound into `buf` starting at sample `at`. */
export function renderSound(
  buf: Float32Array,
  kind: SynthKind,
  at: number,
  gain: number,
  seed: number,
) {
  GENERATORS[kind]({ buf, at, gain: gain * LEVEL[kind], seed });
}

/**
 * Soft clip. Peaks from overlapping sounds get rounded off instead of squared
 * off; hard clipping on a click bed is audible as a crackle.
 */
export function softClip(buf: Float32Array, ceiling = 0.89) {
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.tanh(buf[i] / ceiling) * ceiling;
  }
}

/** 16-bit PCM WAV, mono. Hand-built 44-byte header — no encoder needed. */
export function toWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const n = samples.length;
  const bytes = new Uint8Array(44 + n * 2);
  const view = new DataView(bytes.buffer);

  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i);
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, n * 2, true);

  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }

  return bytes;
}
