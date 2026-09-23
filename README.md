# Reel engine

Code-rendered technical explainer reels: 720x1280, about ten seconds, no voiceover,
built to be watched on mute in a feed and looped.

Each reel is drawn by an **archetype**: a diagram with its own motion and its own
soundtrack. Within an archetype, animation and sound are generated from **one
shared timeline**, so they line up by construction rather than by nudging clips in
an editor. That is the whole design.

## Make a new reel

Ask any coding agent in this repo for one: "make a reel about Redis eviction
policies". The instructions live in `AGENTS.md`, which Codex and Cursor read
natively; `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI) and
`.aider.conf.yml` (Aider) each just load it. It points at the harness-neutral
procedure in `prompts/new-reel.md`. Any other harness: tell the agent to read
`AGENTS.md`. In Claude Code,
`/new-reel <topic>` does the same.

The agent picks the archetype whose claim fits the topic, writes
`scenes/<slug>.json`, and loops on `./scripts/reel.mjs validate <slug> --json`
until it passes. Then:

```bash
./scripts/reel.mjs render <slug>
```

which validates, synthesises the audio, asserts audio-visual sync, and writes
`out/<slug>.mp4`. Dropping a JSON into `scenes/` is enough: compositions are
auto-discovered, no code change needed.

Agents only ever write content. Every field is words or numbers; nothing in a
scene can change the look, so every reel comes out in the same theme. The
channel handle is the one per-channel setting, in `reel.config.json`.

## Archetypes

| `kind` | Claim | Reference scene |
| --- | --- | --- |
| `splitCompare` | The same work two ways; one makes you wait for all of it. | `token-streaming`, `redis-cache-aside` |
| `pipeline` | One stage eats the time; fix it and the path shrinks. | `cold-start` |
| `scaleOut` | Growing the one box means downtime; adding a box does not. | `scale-up-vs-out` |
| `fanOut` | Independent calls: in turn you wait for the sum, fanned out for the slowest. | `promise-all` |
| `layers` | Every layer that can answer saves the trip to the ones below it. | `cdn-cache` |
| `lifecycle` | Skip the release and the resource parks until the pool runs dry. | `connection-leak` |

Authoring guides, including when *not* to use each, are in `prompts/archetypes/`.

## Commands

| | |
| --- | --- |
| `./scripts/reel.mjs <command>` | The CLI agents drive (also `npm run reel -- <command>`): `archetypes`, `schema`, `validate`, `add`, `still`, `render`. `--json` on any of them. See `AGENTS.md` |
| `npm run studio` | Remotion Studio: scrub any frame, live-reload on edit |
| `npm run validate [slug...]` | Check scenes against the schema, the archetype's rules and the layout budgets |
| `npm run audio [slug...]` | Build `public/audio/<slug>.wav` from each scene's timeline |
| `npm run verify -- <slug>` | Assert every sound lands within one frame of its beat |
| `npm run verify -- <file.wav> --describe` | Characterise any reel's audio: tick grid, loop period, peak |
| `npm run render [slug...]` | Full pipeline to MP4 |
| `npm test` | Every scene validates; every archetype's timeline holds its invariants; the CLI's JSON contract |
| `npm run typecheck` | `tsc --noEmit` |

## How it fits together

```
scenes/*.json                     content only: words and numbers, no design, no timing
   |
   v
src/schema/scene.ts               shared fields (header, captions, credits) + stage union
src/archetypes/registry.ts        kind -> { schema, timeline(stage), validate }   (Node-safe)
   |
   v
src/archetypes/<kind>/timeline.ts  <-- THE SINGLE SOURCE OF TRUTH FOR TIME, per archetype
   |         \
   |          \__________________________________
   v                                             v
src/archetypes/<kind>/<Kind>.tsx      scripts/build-audio.mjs
  stateAt(frame) -> what is             buildBeats() -> where each
  on screen right now                   sound goes, sample-exact
   |                                             |
   v                                             v
out/<slug>.mp4  <------- remotion render ------- public/audio/<slug>.wav
```

`src/Reel.tsx` wraps every reel in the same chrome (`src/chrome/`), looks up the
scene's timeline and provides it through `TimelineProvider`, and renders the
archetype's component from `src/archetypes/components.tsx`.

### The one rule

**No component may derive an animation from `useCurrentFrame()` on its own.** Ask
the archetype's timeline through `useTimelineState(timeline)`
(`src/timeline/context.tsx`). The moment two places compute time independently
they drift, and drift is exactly what this format cannot hide when clicks arrive
ten a second.

`scripts/verify-sync.mjs` is the guard: it does RMS-envelope onset detection on
the built WAV and asserts every beat landed within one frame. Every reference
scene currently passes at **0.0ms** worst deviation.

### Timelines

Every timeline implements `Timeline` in `src/timeline/core.ts`: its duration,
named events for captions, tick positions, `buildBeats()` and `stateAt(frame)`.
Timeline modules must stay importable by bare Node (`--experimental-strip-types`):
no React, relative imports with explicit `.ts` extensions, `import type` for types.

What every archetype shares:

- 30fps, a tick every 3 frames (100ms), the same tick loudness phrase (`tickGain`).
- Two cycles. Cycle 0 sets the problem up, cycle 1 pays it off with the stat
  panel, the stinger and the credits.
- The reel opens 12 frames into cycle 0 and ends 12 frames into a third, so the
  loop is seamless. The payoff layer fades out over the last 10 frames
  (`tailFade`).

What differs, and is why reels on different archetypes look and sound different:

| | cycle | ticks | what you hear |
| --- | --- | --- | --- |
| `splitCompare` | 138f (4.6s) | 30 | clicks, thud + whoosh as the buffer dumps, reset riser |
| `pipeline` | 144f (4.8s) | from the weights | thud into the bottleneck, quiet ticks inside, whoosh out; cycle 1 is audibly shorter |
| `scaleOut` | 150f (5.0s) | 35 | accent as a node spawns, thud as the box goes down, whoosh as it returns |
| `fanOut` | 147f (4.9s) | 30 | accent at the join, quieter ticks while only the sequential lane waits, whoosh when it finishes |
| `layers` | 153f (5.1s) | from the depth | harder tick at each layer, thud at the origin or accent on a hit, whoosh on the way back; cycle 1 is shorter |
| `lifecycle` | 156f (5.2s) | 10, every 300ms | thud as the pool runs dry and quieter knocks from blocked requests; a chime as each resource returns |

A timeline may depend on the stage (`pipeline` does: its handoffs land where the
weights put them), so each scene builds its own audio track.

## Design system

Fixed for every reel in the series: recognition in the feed comes from the chrome
staying identical while the diagram changes. All in `src/brand/tokens.ts`.

| Token | Hex | Meaning |
| --- | --- | --- |
| `ground` | `#0B1118` | background |
| `slow` | `#E8C06A` | amber, **the path being argued against** |
| `fast` | `#7FD1B9` | mint, **the path being argued for** |
| `machine` | `#7FC7F0` | ice blue, shared machinery |

`slow`/`fast` are semantic, not decorative. An authored scene chooses which content
goes on which side; it never chooses colour.

Type: Inter for prose, JetBrains Mono for every label, counter and code fragment,
with `"zero"` and `"tnum"` enabled so counters don't jitter as digits change.

## Audio

Six generators in `src/audio/synth.ts`: `tick`, `thud`, `whoosh`, `accent`,
`riser`, `stinger`. No samples, no libraries, no licensing. Seeded xorshift noise,
so two builds of a scene produce byte-identical audio and the sync test means
something. Archetypes differ by where they place these, not by new sounds.

Per-kind levels in `LEVEL` are **calibrated, not guessed**: a 40ms click and a
180ms sine at equal peak amplitude have very different RMS, and matching beat gains
alone produced a mix where the thud drowned the payoff stinger. If you change or
add a generator, re-measure: render each kind in isolation at gain 1.0, take its
peak 20ms RMS, and rescale so the ratios match the target in the comment.

## Layout is not adaptive

There is no reflow or auto-shrink at 720px. The defences:

- **Schema caps** on every text field, enforced by `npm run validate`.
- **Archetype rules** in each `schema.ts` `validate()`: splitCompare's 30-word,
  pixel-budgeted payloads (8 lines at 196px; aim under 90%), pipeline's weights
  summing to 100 with one bottleneck.
- **`fitMono`** in `tokens.ts` auto-sizes text in the narrow stat panels, where
  caps alone can't work: `3.0s = 3.0s` fits and `240ms = 240ms` doesn't, and both
  are legitimate for their topic.

## Adding an archetype

1. Create `src/archetypes/<kind>/` with `schema.ts` (Zod schema, `validate`,
   `describe`), `timeline.ts` (implements `Timeline`) and `<Kind>.tsx`.
2. Register it in `src/archetypes/registry.ts` (schema union + entry, including
   its `meta`: claim, fits, guide, reference scenes, check frames) and
   `src/archetypes/components.tsx`. The compiler flags anything missed; `npm
   test` flags a missing reference scene.
3. Build it from `src/primitives/` where you can. Symmetric layouts use
   `geometry.ts`: define the left side and derive the right with `mirrorX`,
   never hand-write right-side coordinates.
4. Put new sounds on the tick grid, or they collide with neighbouring clicks and
   `npm run verify` reports a non-zero deviation.
5. Make its end state equal its start state, or the platform's loop will snap.
6. Add `prompts/archetypes/<kind>.md` (including when *not* to use it), a row in
   the table in `prompts/author-scene.md`, and a reference scene.
