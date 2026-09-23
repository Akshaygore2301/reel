#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * The one entry point for any agent or human driving the engine.
 *
 *   reel archetypes [--json]            what each archetype claims, and its guide
 *   reel schema [kind] [--json]         JSON Schema of a scene (or of one stage kind)
 *   reel validate <slug|file>... [--json]
 *   reel add <file.json> [--force]      validate, then install into scenes/
 *   reel still <slug|file> [--frame N]  check stills to checks/ (out/ holds only videos)
 *   reel render <slug|file>...          validate -> audio -> verify -> MP4
 *
 * `--json` prints one JSON document on stdout. The exit code is non-zero on any
 * failure, so an agent can loop on `reel validate --json` without parsing prose.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';

import { ARCHETYPES, StageSchema } from '../src/archetypes/registry.ts';
import { SceneSchema, describeBudgets, validateScene } from '../src/schema/scene.ts';
import { ROOT, SCENES_DIR, issuesOf, readScenes, resolveScene } from './lib/scenes.mjs';

const USAGE = `usage: reel <command> [args] [--json]

  archetypes                 list archetypes: claim, fits, guide, reference scenes
  schema [kind]              JSON Schema for a scene, or for one stage kind
  validate <slug|file>...    check scenes against schema, archetype rules, budgets
  add <file.json> [--force]  validate a scene file and install it into scenes/
  still <slug|file> [--frame N]
                             render check stills to checks/<slug>-<N>.png
  render <slug|file>...      full pipeline to out/<slug>.mp4

Workflow for authoring a reel: prompts/new-reel.md`;

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const json = flags.has('--json');
const [command, ...rest] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--frame');

const print = (value, text) => console.log(json ? JSON.stringify(value, null, 2) : text());

function fail(message, extra = {}) {
  if (json) console.log(JSON.stringify({ ok: false, error: message, ...extra }, null, 2));
  else console.error(`  ${message}`);
  process.exit(1);
}

// Under --json, child output goes to stderr so stdout stays one JSON document.
const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: json ? ['ignore', 2, 2] : 'inherit', env: process.env });

/** Resolve an argument to a scene that is installed in scenes/, so Remotion can see it. */
function installedSlug(arg) {
  const { raw, path } = resolveScene(arg);
  const installed = join(SCENES_DIR, `${raw.slug}.json`);
  const same =
    path === installed ||
    (existsSync(installed) && readFileSync(path, 'utf8') === readFileSync(installed, 'utf8'));
  if (!same) fail(`${arg} is not installed. Run: reel add ${arg}`);
  return raw.slug;
}

function validateOne(arg) {
  let file = arg;
  try {
    const found = resolveScene(arg);
    const rel = relative(process.cwd(), found.path);
    file = rel.startsWith('..') ? found.path : rel;
    const scene = validateScene(found.raw);
    return { file, ok: true, slug: scene.slug, kind: scene.stage.kind, budgets: describeBudgets(scene) };
  } catch (err) {
    return { file, ok: false, errors: issuesOf(err) };
  }
}

const commands = {
  archetypes() {
    const list = Object.entries(ARCHETYPES).map(([kind, { meta }]) => ({ kind, ...meta }));
    print(list, () =>
      list
        .map((a) =>
          [
            `${a.kind}`,
            `  claim:     ${a.claim}`,
            `  fits:      ${a.fits.join(', ')}`,
            `  avoid:     ${a.avoid}`,
            `  guide:     ${a.guide}`,
            `  reference: ${a.reference.map((s) => `scenes/${s}.json`).join(', ')}`,
          ].join('\n'),
        )
        .join('\n\n'),
    );
  },

  schema() {
    const [kind] = rest;
    let schema = SceneSchema;
    if (kind) {
      const option = StageSchema.options.find((o) => o.shape.kind.value === kind);
      if (!option) fail(`Unknown kind "${kind}". Have: ${Object.keys(ARCHETYPES).join(', ')}`);
      schema = option;
    }
    // Refinements (word counts, weight sums, caption events) are not expressible
    // in JSON Schema; `reel validate` enforces them.
    const out = z.toJSONSchema(schema, { unrepresentable: 'any' });
    console.log(JSON.stringify(out, null, 2));
  },

  validate() {
    const targets = rest.length ? rest : readScenes().map((s) => join('scenes', s.file));
    const results = targets.map(validateOne);
    const ok = results.every((r) => r.ok);
    print({ ok, results }, () =>
      results
        .map((r) =>
          r.ok
            ? [`  OK   ${r.file}  (${r.slug}, ${r.kind})`, ...r.budgets.map((b) => `         ${b}`)].join(
                '\n',
              )
            : [
                `  FAIL ${r.file}`,
                ...r.errors.map((e) => `         ${e.path ? `${e.path}: ` : ''}${e.message}`),
              ].join('\n'),
        )
        .join('\n'),
    );
    if (!ok) process.exit(1);
  },

  add() {
    const [file] = rest;
    if (!file) fail('usage: reel add <file.json> [--force]');
    const result = validateOne(file);
    if (!result.ok) fail(`${file} is invalid`, { errors: result.errors });
    const dest = join(SCENES_DIR, `${result.slug}.json`);
    const src = resolveScene(file).path;
    if (src !== dest) {
      if (existsSync(dest) && !flags.has('--force')) {
        fail(`scenes/${result.slug}.json already exists. Pass --force to replace it.`);
      }
      copyFileSync(src, dest);
    }
    print(
      { ok: true, slug: result.slug, path: `scenes/${result.slug}.json` },
      () => `  installed scenes/${result.slug}.json`,
    );
  },

  still() {
    const [arg] = rest;
    if (!arg) fail('usage: reel still <slug|file> [--frame N]');
    const slug = installedSlug(arg);
    const i = argv.indexOf('--frame');
    const frames =
      i >= 0 ? [Number(argv[i + 1])] : ARCHETYPES[resolveScene(arg).raw.stage.kind].meta.checkFrames;
    if (frames.some((f) => !Number.isInteger(f))) fail('--frame takes an integer');
    mkdirSync(join(ROOT, 'checks'), { recursive: true });
    const outputs = frames.map((frame) => {
      const out = join('checks', `${slug}-${frame}.png`);
      run('npx', ['remotion', 'still', 'src/index.ts', slug, out, `--frame=${frame}`, '--log=error']);
      return out;
    });
    print({ ok: true, stills: outputs }, () => outputs.map((o) => `  ${o}`).join('\n'));
  },

  render() {
    if (rest.length === 0) fail('usage: reel render <slug|file>...');
    const slugs = rest.map(installedSlug);
    run('node', ['--experimental-strip-types', 'scripts/render.mjs', ...slugs]);
    if (json) print({ ok: true, videos: slugs.map((s) => `out/${s}.mp4`) });
  },
};

if (!command || flags.has('--help') || !(command in commands)) {
  console.log(USAGE);
  process.exit(command && !flags.has('--help') ? 1 : 0);
}

try {
  commands[command]();
} catch (err) {
  fail(err.message);
}
