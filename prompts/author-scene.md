# Authoring a scene

A scene is pure content. All visual design and all timing live in code — you are
writing the words and the numbers, nothing else. Output is a single JSON file at
`scenes/<slug>.json`, validated by `npm run validate`.

## The format you are writing for

9.2 seconds, 720x1280, no voiceover, watched on mute in a feed and then looped.
Two narrative cycles of 4.6s each. Cycle 0 sets the problem up; cycle 1 pays it
off and reveals the credits. The viewer sees roughly **three** things: the title,
the diagram moving, and the caption pill. Everything else is texture.

Consequences:

- The title has to name the topic in four words or fewer.
- The caption pill carries the argument. If someone read only the four captions,
  they should have learned the thing.
- Nobody reads the small mono labels on a first pass. They exist to make the
  diagram feel like an instrument, and to reward a second watch.

## Rules that will get you rejected

1. **`payloads` must contain exactly 30 words each.** One word per click, one
   click per 100ms. 29 words desynchronises the entire cycle. Count them.
2. **One entry per cycle**, so two entries. Two different sentences: the reel shows
   a different example each cycle, which is what makes the second cycle worth
   watching.
3. **No word longer than 14 characters**, and keep the payload under 90% of the
   screen budget (`npm run validate` prints the percentage). There is no text
   reflow — an over-long payload is silently clipped.
4. **Respect the length caps** on every field. They are in `src/schema/scene.ts`
   and they are real: the layout does not adapt.
5. **Never mention colour.** You do not choose it. See below.

## Colour is semantic and not yours to assign

The palette is fixed for every reel in the series. The archetype assigns it:

| Role | Colour | Meaning |
| --- | --- | --- |
| `slow` | amber | the naive, blocking, or wrong-by-default path |
| `fast` | mint | the correct, optimised path |
| `source` | ice blue | shared machinery that belongs to neither path |

So the only thing you control is **which side of the comparison is which**. Put
the thing being argued against in `slow` and the thing being argued for in `fast`.
Getting this backwards produces a reel that validates cleanly and reads as
nonsense.

## Choosing a topic that fits

The `splitCompare` archetype makes one claim: *the same work, done two ways, and
one of them makes you wait for all of it before you get any of it.* It fits any
topic shaped like that:

- streaming vs buffering a response
- cache hit vs cold read
- paginated query vs loading every row
- incremental build vs full rebuild
- async fan-out vs sequential awaits

It does **not** fit topics with no natural pair, or where the win is about
correctness rather than time-to-first-result. Don't force those into it.

## Be honest in the `stat` block

`stat.firstBefore` → `stat.firstAfter` is the win. `stat.lastText` is the caveat,
and it is not optional. In the token-streaming reel the caveat is `3.0s = 3.0s`:
the last word arrives at exactly the same moment either way. Streaming does not
make the model faster, and saying so is what makes the rest of the reel
believable. Find the equivalent caveat for your topic and put it there.

If your topic has no caveat, you have probably overstated the win.

## Captions

Two to six, four is right. Anchored to beats, never to frames:

- `{ "cycle": 0, "token": 10 }` — on the 10th click of cycle 0
- `{ "cycle": 0, "on": "dump" }` — the moment the buffer opens
- `{ "cycle": 1, "on": "payoff" }` — the conclusion

A working shape:

1. cycle 0, early — **the question** the viewer already has
2. cycle 0, `on: "dump"` — **what just happened** on screen
3. cycle 1, early — **the mechanism**, stated plainly
4. cycle 1, mid — **why it matters to them**, in second person

Sentence case. End with `.` or `?`. Under 52 characters, because the pill does not
wrap.

## Worked example

`scenes/token-streaming.json` is the reference implementation. Read it before
writing a new one.

## Checklist before you hand it over

- [ ] Both payloads are exactly 30 words
- [ ] `npm run validate` passes and reports under 90% screen budget
- [ ] The amber side is the one you are arguing against
- [ ] `stat.lastText` states a real caveat
- [ ] The four captions alone teach the concept
- [ ] `slug` is kebab-case and unique
- [ ] `handle` is `@builddebugship`
