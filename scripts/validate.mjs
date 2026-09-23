/**
 * Validates scenes/*.json against the schema, including the rules a JSON schema
 * cannot express (per-archetype rules such as exact word counts and on-screen text
 * budgets, and caption anchors that must name a real event of the archetype).
 *
 * Run: node --experimental-strip-types scripts/validate.mjs [slug | path.json ...]
 *
 * This is the gate on LLM-authored scenes. Every failure here is something that
 * would otherwise ship as a silent visual bug: text overflowing a screen face, or
 * a payload whose last word does not land on the last click.
 */
import { validateScene, describeBudgets } from '../src/schema/scene.ts';
import { issuesOf, selectScenes } from './lib/scenes.mjs';

const files = selectScenes();

if (files.length === 0) {
  console.error('  no scenes in scenes/');
  process.exit(1);
}

let failed = 0;

for (const { file, raw } of files) {
  try {
    const scene = validateScene(raw);
    const budgets = describeBudgets(scene);
    console.log(`  OK  ${file}  (${scene.slug}, ${scene.stage.kind})`);
    for (const line of budgets) console.log(`        ${line}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${file}`);
    for (const { path, message } of issuesOf(err)) {
      console.error(`        ${path ? `${path}: ` : ''}${message}`);
    }
  }
}

if (failed > 0) {
  console.error(`\n  ${failed} of ${files.length} scene(s) invalid\n`);
  process.exit(1);
}
console.log(`\n  ${files.length} scene(s) valid\n`);
