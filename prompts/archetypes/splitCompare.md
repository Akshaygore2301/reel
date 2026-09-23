# `splitCompare`

**Claim:** the same work, done two ways, and one of them makes you wait for all of
it before you get any of it.

**Picture:** one machine emits a unit every 100ms onto two belts. The amber belt
feeds a cage that holds everything back and then dumps it at once; the mint belt
feeds a screen directly. Two screens type out a sentence word by word.

**Reference:** `scenes/token-streaming.json`, `scenes/redis-cache-aside.json`.

## Use it for

- streaming vs buffering a response
- cache hit vs cold read
- paginated query vs loading every row
- incremental build vs full rebuild

## Do not use it for

Topics with no natural pair, a win about correctness rather than
time-to-first-result, or one path where the question is where the time goes (that
is `pipeline`).

## Which side is which

- `slow`, `buffer`: amber, the approach argued against
- `fast`: mint, the approach argued for
- `source`: the shared machine

## Hard rules

1. **`payloads` must contain exactly 30 words each.** One word per click, one
   click per 100ms. 29 words desynchronises the entire cycle. Count them.
2. **One entry per cycle**, so two entries, two different sentences: the reel shows
   a different example each cycle, which is what makes the second cycle worth
   watching.
3. **No word longer than 14 characters**, and keep each payload under 90% of the
   screen budget (`npm run validate` prints the percentage). There is no text
   reflow: an over-long payload is silently clipped.

## Caption events

`dump` (the buffer opens), `payoff`, `reset`. `token` runs 1..30 in both cycles.

## Check still

`--frame=245`: the payoff, with both screens full and the stat panel wedged
between them. Its labels must sit on one line each.
