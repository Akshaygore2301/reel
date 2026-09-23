/**
 * Invariants every scene and every archetype must hold. Run: npm test
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { ARCHETYPES, timelineFor } from '../src/archetypes/registry.ts';
import { validateScene } from '../src/schema/scene.ts';
import { resolveAnchor } from '../src/timeline/anchors.ts';
import { ROOT, readScenes } from '../scripts/lib/scenes.mjs';

const scenes = readScenes();

describe('scenes/*.json', () => {
  for (const { file, raw } of scenes) {
    test(`${file} validates, and its captions land inside the video`, () => {
      const scene = validateScene(raw);
      assert.equal(file, `${scene.slug}.json`, 'file name must be <slug>.json');
      const t = timelineFor(scene.stage);
      for (const c of scene.captions) {
        const at = resolveAnchor(t, c.at);
        assert.ok(at >= 0 && at < t.durationInFrames, `caption "${c.text}" at frame ${at}`);
      }
    });
  }
});

describe('archetypes', () => {
  for (const [kind, { meta }] of Object.entries(ARCHETYPES)) {
    describe(kind, () => {
      const refs = meta.reference.map((slug) => scenes.find((s) => s.raw.slug === slug));

      test('has installed reference scenes', () => {
        assert.ok(refs.length > 0);
        refs.forEach((r, i) => assert.ok(r, `reference scene "${meta.reference[i]}" is missing`));
      });

      for (const ref of refs.filter(Boolean)) {
        const t = timelineFor(validateScene(ref.raw).stage);

        test(`${ref.raw.slug}: beats are sorted and on the grid`, () => {
          const beats = t.buildBeats();
          for (let i = 1; i < beats.length; i++) assert.ok(beats[i].frame >= beats[i - 1].frame);
          for (const b of beats) assert.ok(Number.isInteger(b.frame), `${b.kind} at ${b.frame}`);
        });

        test(`${ref.raw.slug}: events of every cycle fall inside the video`, () => {
          for (let cycle = 0; cycle < t.cycles; cycle++) {
            for (const name of t.events) {
              const f = t.eventFrame(cycle, name);
              assert.ok(f < t.durationInFrames, `${name} in cycle ${cycle} at ${f}`);
            }
          }
        });

        test(`${ref.raw.slug}: check frames are inside the video`, () => {
          for (const f of meta.checkFrames) assert.ok(f < t.durationInFrames);
        });

        test(`${ref.raw.slug}: the payoff layer is gone on the last frame, so the loop is clean`, () => {
          const last = t.stateAt(t.durationInFrames - 1);
          assert.equal(last.statReveal, 0);
          assert.equal(last.payoffProgress, 0);
          const first = t.stateAt(0);
          assert.equal(first.statReveal, 0);
          assert.equal(first.payoffProgress, 0);
        });
      }
    });
  }
});

describe('reel CLI', () => {
  const reel = (...args) => {
    try {
      return { code: 0, out: execFileSync(join(ROOT, 'scripts/reel.mjs'), args, { cwd: ROOT, encoding: 'utf8' }) };
    } catch (err) {
      return { code: err.status, out: err.stdout };
    }
  };

  test('validate --json reports structured errors and exits 1', () => {
    const { code, out } = reel('validate', 'tests/fixtures/bad-scene.json', '--json');
    assert.equal(code, 1);
    const report = JSON.parse(out);
    assert.equal(report.ok, false);
    const paths = report.results[0].errors.map((e) => e.path);
    assert.ok(paths.includes('slug'));
    assert.ok(paths.includes('captions.0.text'));
  });

  test('archetypes --json lists every registered kind', () => {
    const list = JSON.parse(reel('archetypes', '--json').out);
    assert.deepEqual(list.map((a) => a.kind).sort(), Object.keys(ARCHETYPES).sort());
  });

  test('schema emits JSON Schema for a stage kind', () => {
    const schema = JSON.parse(reel('schema', 'pipeline').out);
    assert.equal(schema.properties.kind.const, 'pipeline');
  });
});
