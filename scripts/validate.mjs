/**
 * Validates scenes/*.json against the schema, including the rules a JSON schema
 * cannot express (exact word counts, on-screen text budgets).
 *
 * Run: node --experimental-strip-types scripts/validate.mjs [slug ...]
 *
 * This is the gate on LLM-authored scenes. Every failure here is something that
 * would otherwise ship as a silent visual bug: text overflowing a screen face, or
 * a payload whose last word does not land on the last click.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateScene, describeBudgets } from '../src/schema/scene.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(ROOT, 'scenes');

const requested = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, raw: JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
  .filter(({ raw }) => requested.length === 0 || requested.includes(raw.slug));

if (files.length === 0) {
  console.error(`  no scenes matched ${requested.join(', ') || '(all)'}`);
  process.exit(1);
}

let failed = 0;

for (const { file, raw } of files) {
  try {
    const scene = validateScene(raw);
    const budgets = describeBudgets(scene);
    console.log(`  OK  ${file}  (${scene.slug})`);
    for (const line of budgets) console.log(`        ${line}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${file}`);
    for (const line of String(err.message).split('\n')) console.error(`        ${line}`);
  }
}

if (failed > 0) {
  console.error(`\n  ${failed} of ${files.length} scene(s) invalid\n`);
  process.exit(1);
}
console.log(`\n  ${files.length} scene(s) valid\n`);
