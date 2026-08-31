# Reel engine

Code-rendered technical explainer reels: 720x1280, 9.2s, no voiceover, built to be
watched on mute in a feed and looped.

Animation and sound are generated from **one shared timeline**, so they line up by
construction rather than by nudging clips in an editor. That is the whole design.

## Make a new reel

```bash
/new-reel Redis eviction policies
```

That slash command reads `prompts/author-scene.md`, writes `scenes/<slug>.json`,
and validates it. Then:

```bash
npm run render <slug>
```

which validates, synthesises the audio, asserts audio-visual sync, and writes
`out/<slug>.mp4`. Dropping a JSON into `scenes/` is enough — compositions are
auto-discovered, no code change needed.

## Commands

| | |
| --- | --- |
| `npm run studio` | Remotion Studio — scrub any frame, live-reload on edit |
| `npm run validate` | Check every scene against the schema and the layout budgets |
| `npm run audio` | Build `public/audio/<slug>.wav` from the timeline |
| `npm run verify` | Assert every sound lands within one frame of its beat |
| `npm run verify -- <file.wav> --describe` | Characterise any reel's audio: tick grid, loop period, peak |
| `npm run render [slug...]` | Full pipeline to MP4 |
| `npm run typecheck` | `tsc --noEmit` |

## How it fits together

```
scenes/*.json          content only — words and numbers, no design, no timing
   |
   v
src/schema/scene.ts    Zod contract + the rules a type can't express
   |
   v
src/timeline/beats.ts  <-- THE SINGLE SOURCE OF TRUTH FOR TIME
   |         \
   |          \______________________________
   v                                         v
src/Reel.tsx (React)              scripts/build-audio.mjs
  stateAt(frame) -> what is           buildBeats() -> where each
  on screen right now                 sound goes, sample-exact
   |                                         |
   v                                         v
out/<slug>.mp4  <----- remotion render ----- public/audio/<slug>.wav
```

### The one rule

**No component may derive an animation from `useCurrentFrame()` on its own.** Ask
`stateAt(frame)`. The moment two places compute time independently they drift, and
drift is exactly what this format cannot hide when clicks arrive ten a second.

`scripts/verify-sync.mjs` is the guard: it does RMS-envelope onset detection on the
rendered WAV and asserts every beat landed within one frame. Currently **0.0ms**
worst deviation on 66 independently detectable beats.

## The timeline

One cycle is 138 frames (4.600s); a reel is two cycles plus a short tail.

| Cycle-local frame | Event |
| --- | --- |
| 0–87 | emission — 30 units, one click every 3 frames (100ms) |
| 93 | `thud`, the buffer unlocks |
| 95 | `whoosh`, it dumps everything at once |
| 113 | `accent` in cycle 0; `stinger` + credits in cycle 1 |
| 132 | `riser`, reset sweep |

Cycle 0 sets the problem up, cycle 1 pays it off. They are deliberately not
identical — the payoff cycle adds the comparison panel and the credits, which is
what makes a second watch worth anything.

The reel opens 12 frames into emission (on unit 5) and ends 12 frames into a third
cycle, so the token count loops seamlessly. The payoff layer fades out over the
last 10 frames (`tailFade`) so the loop point is invisible.

## Design system

Fixed for every reel in the series — recognition in the feed comes from the chrome
staying identical while the diagram changes. All in `src/brand/tokens.ts`.

| Token | Hex | Meaning |
| --- | --- | --- |
| `ground` | `#0B1118` | background |
| `slow` | `#E8C06A` | amber — **the path being argued against** |
| `fast` | `#7FD1B9` | mint — **the path being argued for** |
| `machine` | `#7FC7F0` | ice blue — shared machinery |

`slow`/`fast` are semantic, not decorative. An authored scene chooses which content
goes on which side; it never chooses colour.

Type: Inter for prose, JetBrains Mono for every label, counter and code fragment,
with `"zero"` and `"tnum"` enabled so counters don't jitter as digits change.

## Audio

Six generators in `src/audio/synth.ts` — `tick`, `thud`, `whoosh`, `accent`,
`riser`, `stinger`. No samples, no libraries, no licensing. Seeded xorshift noise,
so two renders of a scene produce byte-identical audio and the sync test means
something.

Per-kind levels in `LEVEL` are **calibrated, not guessed**: a 40ms click and a
180ms sine at equal peak amplitude have very different RMS, and matching beat gains
alone produced a mix where the thud drowned the payoff stinger. If you change a
generator, re-measure — render each kind in isolation at gain 1.0, take its peak
20ms RMS, and rescale so the ratios match the target in the comment.

Every splitCompare reel shares the same soundtrack, because the archetype's rhythm
is fixed. That is why `build-audio.mjs` writes the same buffer under each slug.

## Layout is not adaptive

There is no reflow or auto-shrink at 720px. Two defences:

- **Schema caps** on every text field, enforced by `npm run validate`.
- **Screen-face budget** — payloads are costed in pixels against the measured
  capacity of the screen (8 lines at 196px). Validation prints the utilisation;
  aim under 90%.
- **`fitMono`** in `tokens.ts` auto-sizes text in the 78px stat panel, where caps
  alone can't work: `3.0s = 3.0s` fits and `240ms = 240ms` doesn't, and both are
  legitimate for their topic.

## Adding an archetype

`splitCompare` (`src/archetypes/SplitCompare.tsx`) is the only one so far. To add
another:

1. Add its variant to `StageSchema` in `src/schema/scene.ts`.
2. Build it from the primitives in `src/primitives/` — geometry in
   `geometry.ts` is mirror-symmetric about `MID`; define the left side and derive
   the right with `mirror`, never hand-write right-side coordinates.
3. Branch on `scene.stage.kind` in `src/Reel.tsx`.
4. If its rhythm differs from 30-units-at-100ms, parameterise `TIMING` in
   `beats.ts` — and keep both `buildBeats` and `stateAt` reading the same constants.
5. Make its end state equal its start state, or the platform's loop will snap.
6. Document it in `prompts/author-scene.md`, including when *not* to use it.
