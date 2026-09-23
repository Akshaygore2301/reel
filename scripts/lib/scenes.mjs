/**
 * Reads scenes for the pipeline scripts and the `reel` CLI. Raw JSON only:
 * callers decide whether to validate, so `validate.mjs` can report every
 * failure instead of stopping at the first.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCENES_DIR = join(ROOT, 'scenes');

/** Every scene as `{ file, raw }`, sorted by file name. */
export function readScenes() {
  return readdirSync(SCENES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, raw: JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf8')) }));
}

const isPath = (arg) => arg.endsWith('.json') || arg.includes('/');

/**
 * One scene by slug (looked up in scenes/) or by path to any JSON file.
 * Throws with an author-facing message when it cannot be found or parsed.
 */
export function resolveScene(arg) {
  if (isPath(arg)) {
    const path = resolve(arg);
    if (!existsSync(path)) throw new Error(`No such file: ${arg}`);
    let raw;
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      throw new Error(`${arg} is not valid JSON: ${err.message}`);
    }
    return { file: basename(path), path, raw };
  }
  const found = readScenes().find((s) => s.raw.slug === arg);
  if (!found) {
    const slugs = readScenes().map((s) => s.raw.slug);
    throw new Error(`No scenes/*.json declares slug "${arg}". Have: ${slugs.join(', ')}`);
  }
  return { ...found, path: join(SCENES_DIR, found.file) };
}

/**
 * The scenes named on the command line (by slug or path), or all of them.
 * Exits with a useful message on an unknown one.
 */
export function selectScenes(argv = process.argv.slice(2)) {
  const requested = argv.filter((a) => !a.startsWith('--'));
  if (requested.length === 0) return readScenes();
  try {
    return requested.map(resolveScene);
  } catch (err) {
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}

/**
 * Validation failures as `{ path, message }`, whether they came from the zod
 * schema (many issues) or an archetype's `validate` (one message).
 */
export function issuesOf(err) {
  if (Array.isArray(err?.issues)) {
    return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  }
  return [{ path: '', message: String(err?.message ?? err) }];
}
