# Authoring a scene

A scene is pure content. All visual design and all timing live in code: you are
writing the words and the numbers, nothing else. Output is a single JSON file at
`scenes/<slug>.json`, validated by `./scripts/reel.mjs validate`. The step-by-step
procedure is `prompts/new-reel.md`.

## The format you are writing for

About ten seconds, 720x1280, no voiceover, watched on mute in a feed and then
looped. Two narrative cycles. Cycle 0 sets the problem up; cycle 1 pays it off
and reveals the stat panel and credits. The viewer sees roughly **three**
things: the title, the diagram moving, and the caption pill. Everything else is
texture.

Consequences:

- The title has to name the topic in four words or fewer.
- The caption pill carries the argument. If someone read only the four captions,
  they should have learned the thing.
- Nobody reads the small mono labels on a first pass. They exist to make the
  diagram feel like an instrument, and to reward a second watch.

## Pick the archetype first

The diagram, its motion and its soundtrack come from the archetype (`stage.kind`).
Each one makes a single claim. Pick the one whose claim IS your topic's argument.
Do not bend a topic into an archetype that makes a different claim: it validates
and reads as nonsense.

<!-- Mirrors `meta` in src/archetypes/registry.ts, which is authoritative: `./scripts/reel.mjs archetypes` prints it. -->

| `kind` | The claim | Fits | Guide |
| --- | --- | --- | --- |
| `splitCompare` | The same work done two ways; one makes you wait for all of it before you get any of it. | streaming vs buffering, cache hit vs cold read, pagination, incremental builds | `prompts/archetypes/splitCompare.md` |
| `pipeline` | One path, and one stage in it eats the time. Fix that stage and the whole path shrinks. | request lifecycle, cold starts, CI runs, query plans, page load waterfalls | `prompts/archetypes/pipeline.md` |
| `scaleOut` | Capacity ran out. Growing the one box means downtime; adding a box does not. | vertical vs horizontal scaling, bigger DB vs sharding, worker pools | `prompts/archetypes/scaleOut.md` |
| `fanOut` | Independent calls. Made in turn you wait for the sum; fanned out you wait only for the slowest. | Promise.all, parallel API calls, scatter-gather, sharded tests | `prompts/archetypes/fanOut.md` |
| `layers` | A request falls through layers until one can answer; every layer that answers saves the trip below it. | CDN, cache in front of a DB, CPU caches, DNS resolution | `prompts/archetypes/layers.md` |
| `lifecycle` | A pooled resource has to come back. Skip the release and it parks in one state until the pool runs dry. | connection leaks, TIME_WAIT, unclosed file descriptors, unreleased locks | `prompts/archetypes/lifecycle.md` |

Read the guide for the archetype you pick. It has that archetype's fields, its
hard rules and its caption events. If no archetype fits, say so and stop:
a new archetype is a code change, not a content change.

## Rules for every archetype

1. **Respect the length caps** on every field. `./scripts/reel.mjs schema <kind>`
   prints them all, and they are real: the layout does not adapt.
2. **Never mention colour.** You do not choose it. See below.
3. **Leave `handle` out.** It comes from `reel.config.json`, the same for every
   reel on the channel.

## Colour is semantic and not yours to assign

The palette is fixed for every reel in the series. The archetype assigns it:

| Role | Colour | Meaning |
| --- | --- | --- |
| `slow` | amber | the naive, blocking, or wrong-by-default path |
| `fast` | mint | the correct, optimised path |
| `source` | ice blue | shared machinery that belongs to neither path |

So the only thing you control is **which content goes where**. Put the thing
being argued against on the amber side and the thing being argued for on the
mint side. Each guide says which fields are which.

## Be honest in the `stat` block

Every archetype has one. `stat.firstBefore` -> `stat.firstAfter` is the win.
`stat.lastText` is the caveat, and it is not optional. In the token-streaming reel
the caveat is `3.0s = 3.0s`: the last word arrives at exactly the same moment
either way. Streaming does not make the model faster, and saying so is what makes
the rest of the reel believable. Find the equivalent caveat for your topic.

If your topic has no caveat, you have probably overstated the win.

## Captions

Two to six, four is right. Anchored to beats, never to frames:

- `{ "cycle": 0, "token": 10 }`: on the 10th tick of cycle 0
- `{ "cycle": 0, "on": "<event>" }`: on a named event of the archetype. Each
  guide lists its events; validation rejects any other name.

The reel opens 12 frames into cycle 0, so the first caption must land after
that: `token` 5 or later on archetypes that tick every 100ms. The guide says
when an archetype ticks at a different rate (`lifecycle`: `token` 3).
Validation rejects a caption that would land before the first frame.

A working shape:

1. cycle 0, early: **the question** the viewer already has
2. cycle 0, on the archetype's key event: **what just happened** on screen
3. cycle 1, early: **the mechanism**, stated plainly
4. cycle 1, later: **why it matters to them**, in second person

Sentence case. End with `.` or `?`. Under 52 characters, because the pill does not
wrap.

## Checklist before you hand it over

- [ ] The archetype's claim is the topic's argument, not a stretch
- [ ] The archetype guide's hard rules hold
- [ ] `npm run validate` passes
- [ ] The amber side is the one you are arguing against
- [ ] `stat.lastText` states a real caveat
- [ ] The four captions alone teach the concept
- [ ] `slug` is kebab-case and unique
- [ ] no `handle` field (it comes from `reel.config.json`)
