/**
 * Full pipeline for one or more scenes: validate -> build audio -> render MP4.
 *
 * Run: node --experimental-strip-types scripts/render.mjs [slug ...]
 *
 * Ordering matters. The audio has to exist before Remotion bundles, because
 * staticFile() resolves at render time; and validation has to run before either,
 * because a payload with the wrong word count produces a video that looks fine in
 * stills and drifts in motion.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, selectScenes } from './lib/scenes.mjs';

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: process.env });

const slugs = selectScenes().map((s) => s.raw.slug);

console.log(`\n[1/4] validating ${slugs.length} scene(s)`);
run('node', ['--experimental-strip-types', 'scripts/validate.mjs', ...slugs]);

console.log(`\n[2/4] building audio`);
run('node', ['--experimental-strip-types', 'scripts/build-audio.mjs', ...slugs]);

console.log(`\n[3/4] verifying audio-visual sync`);
for (const slug of slugs) {
  run('node', ['--experimental-strip-types', 'scripts/verify-sync.mjs', slug]);
}

console.log(`\n[4/4] rendering`);
for (const slug of slugs) {
  run('npx', [
    'remotion',
    'render',
    'src/index.ts',
    slug,
    join('out', `${slug}.mp4`),
    '--log=error',
  ]);
  const out = join(ROOT, 'out', `${slug}.mp4`);
  console.log(existsSync(out) ? `  out/${slug}.mp4` : `  FAILED: ${slug}`);
}

console.log('');
