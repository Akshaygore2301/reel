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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: process.env });

const allSlugs = readdirSync(join(ROOT, 'scenes'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'scenes', f), 'utf8')).slug);

const requested = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const slugs = requested.length > 0 ? requested : allSlugs;

for (const slug of slugs) {
  if (!allSlugs.includes(slug)) {
    console.error(`No scenes/*.json declares slug "${slug}". Have: ${allSlugs.join(', ')}`);
    process.exit(1);
  }
}

console.log(`\n[1/4] validating ${slugs.length} scene(s)`);
run('node', ['--experimental-strip-types', 'scripts/validate.mjs', ...slugs]);

console.log(`\n[2/4] building audio`);
run('node', ['--experimental-strip-types', 'scripts/build-audio.mjs', ...slugs]);

console.log(`\n[3/4] verifying audio-visual sync`);
for (const slug of slugs) {
  run('node', [
    '--experimental-strip-types',
    'scripts/verify-sync.mjs',
    join('public', 'audio', `${slug}.wav`),
  ]);
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
