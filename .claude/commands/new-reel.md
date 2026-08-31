---
description: Author a new reel scene from a topic
argument-hint: '[topic, e.g. "Redis eviction policies"]'
---

Author a new reel scene for the topic: **$ARGUMENTS**

## Steps

1. Read `prompts/author-scene.md` in full. It contains the rules, the length caps,
   and the reasons behind them. Do not skip it — most of its rules exist because
   breaking them produces a scene that validates and still looks wrong.

2. Read `scenes/token-streaming.json` as the reference implementation, and
   `src/schema/scene.ts` for the authoritative field caps.

3. Check the topic actually fits the `splitCompare` archetype: *the same work done
   two ways, one of which makes you wait for all of it before you get any of it.*
   If it doesn't fit, say so and propose the nearest framing that does, rather than
   forcing it.

4. Write `scenes/<slug>.json`. Count the payload words by hand — exactly 30 each,
   two different sentences.

5. Run validation and iterate until it passes with both payloads under 90%:

   ```bash
   npm run validate
   ```

6. Render a still at the payoff frame and look at it before declaring done:

   ```bash
   npx remotion still src/index.ts <slug> out/<slug>-check.png --frame=245
   ```

   Check: nothing clipped, no text overlapping the screen bezels, the stat panel
   labels on one line each.

7. Report the four captions back as a list, so the argument of the reel can be
   reviewed without watching it. Do not render the full MP4 unless asked — that is
   `npm run render <slug>` and it takes a few minutes.

## Constraints

- `handle` is always `@builddebugship`.
- Never assign colours. Amber is the path being argued against, mint is the one
  being argued for; you choose only which content goes on which side.
- `stat.lastText` must state a genuine caveat, not a second win.
