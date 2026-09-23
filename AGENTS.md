# Reel engine

Code-rendered technical explainer reels: 720x1280, about ten seconds, no
voiceover, looped. Remotion draws them from a JSON scene; the audio is
synthesised from the same timeline, so sound and picture are in sync by
construction.

## If you were asked to make a reel

Follow `prompts/new-reel.md`. In short: pick an archetype with
`./scripts/reel.mjs archetypes`, write `scenes/<slug>.json`, loop on
`./scripts/reel.mjs validate <slug> --json` until it passes, check stills with
`./scripts/reel.mjs still <slug>`.

## The theme is fixed

Every reel in the series looks the same: the palette, fonts, header, caption
pill, glowing wireframe strokes and credits all live in `src/brand/` and
`src/chrome/`. A scene is pure content (words and numbers) and has no field
that can change the look. Do not edit those directories to make a scene fit;
if a topic will not fit any archetype, say so. The only per-channel setting
is the handle, in `reel.config.json`.

## Commands

| | |
| --- | --- |
| `./scripts/reel.mjs archetypes [--json]` | What each archetype claims, its guide, its reference scenes |
| `./scripts/reel.mjs schema [kind]` | JSON Schema of a scene or one stage kind: every field and cap |
| `./scripts/reel.mjs validate <slug\|file>... [--json]` | Schema, archetype rules and layout budgets |
| `./scripts/reel.mjs add <file.json> [--force]` | Validate a scene written elsewhere and install it into `scenes/` |
| `./scripts/reel.mjs still <slug> [--frame N]` | Check stills to `checks/<slug>-<N>.png` (`out/` holds only videos) |
| `./scripts/reel.mjs render <slug>...` | Full pipeline to `out/<slug>.mp4` |
| `npm test` | Every scene validates; every archetype's timeline holds its invariants |
| `npm run typecheck` | `tsc --noEmit` |

## Changing the engine

For work on the engine itself (a new archetype, a timing change), read
`README.md`: the one rule (no component reads `useCurrentFrame()` for
animation; ask the archetype's timeline) and the "Adding an archetype"
checklist. `npm test`, `npm run typecheck` and `./scripts/reel.mjs render` on an
affected reference scene (sync must report 0.0ms) are the definition of done.
