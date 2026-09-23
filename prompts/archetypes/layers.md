# `layers`

**Claim:** a request falls through layers until one can answer. Every layer
that answers saves the trip to everything below it.

**Picture:** a spine on the left and a stack of slabs hanging off it. The slabs
widen as they get slower: small and fast on top, big and slow at the bottom. On
the cold cycle the request asks each layer in turn (MISS, amber), reaches the
origin at the bottom, and on the way back up the answer is STORED in the cache
layer. On the warm cycle the same request stops there (HIT, mint), and every
layer below it stays dark and dashed, never touched. A latency clock adds up the
real cost of each layer asked.

**Reference:** `scenes/cdn-cache.json`.

## Use it for

- a CDN in front of the origin
- a cache (Redis, memcached) in front of a database
- CPU caches: L1, L2, L3, RAM
- DNS: browser, OS, resolver, authoritative

## Do not use it for

Two whole approaches side by side (that is `splitCompare`), a single cache in
front of a single store with nothing else to show (also `splitCompare`), or a
stack where the upper layers are not actually faster.

## Which side is which

The cold trip down to the origin is amber (argued against). The warm hit is mint
(argued for). Layers being asked are ice blue.

## Fields

- `layers`: 3 to 5, each `{ name, detail, ms }`, **fastest first**. The last
  layer is the origin: it always has the answer. `ms` is a number and may be
  fractional: `0.000001` renders as `1ns`, `0.09` as `90µs`.
- `hitLayer`: index of the layer that answers on the warm cycle. Any layer
  except the origin. It is also the layer the answer is stored in on the cold
  cycle, so choose the layer the reel is about.
- `unitLabel` / `clockLabel`: the two counters, e.g. `"LAYERS ASKED"`,
  `"LATENCY"`.

## Hard rules

1. **Each layer is slower than the one above it.** Validation enforces it.
2. **On-screen time is not to scale.** Each layer gets the same beat; the clock
   shows real numbers. `stat.firstBefore` is the cold total (every layer's `ms`
   added up) and `stat.firstAfter` the warm total (every layer down to
   `hitLayer`). `npm run validate` prints both; copy them.
3. **The caveat is the cold path**, or something as real: the first request
   still pays full price, a hit can be stale until it expires, the cache costs
   memory.

## Caption events

`found` (the answer is found: the origin on the cold cycle, `hitLayer` on the
warm one), `done` (the answer is back at the top; the clock stops), `payoff`,
`reset`. `token` counts ticks, and cycle 1 has fewer than cycle 0; validation
tells you how many.

## Check still

`--frame=66` (cold cycle, answer found at the origin, STORED on the cache layer)
and `--frame=268` (warm cycle after the payoff: HIT, the dashed layers below it,
the stat strip on one line).
