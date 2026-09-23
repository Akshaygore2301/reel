# `scaleOut`

**Claim:** capacity ran out. Growing the one box means taking it down; adding a
box does not.

**Picture:** one source sends a request every 100ms to both sides. Both hit
100% load at the same moment. On the amber side the single server goes offline to
be resized while requests pile up at its door, then comes back bigger and swallows
the queue at once. On the mint side a second identical node slides in behind the
router and serving never stops. Counters show requests served per side.

**Reference:** `scenes/scale-up-vs-out.json`.

## Use it for

- vertical vs horizontal scaling
- a bigger database instance vs sharding or read replicas
- a faster single worker vs a worker pool
- one bigger broker vs more partitions

## Do not use it for

Arguments about speed per request (neither side gets faster), or cases where the
up side genuinely resizes without downtime. Then the reel would be false.

## Which side is which

- `up`: amber, growing the one box (argued against)
- `out`: mint, adding boxes (argued for)
- `source`: the shared traffic

## Fields

- `up.unit` / `up.unitAfter`: the box's size before and after, e.g. `"4 vCPU"`
  -> `"16 vCPU"`.
- `up.offlineLabel`: shown on the box while it is down, e.g. `"resizing"`.
- `out.unit`: each node's size, usually the same as `up.unit`.
- `out.router`: what spreads the work, e.g. `"BALANCER"`, `"ROUTER"`.
- `out.spawnLabel`: tag on the new node, e.g. `"+1 NODE"`.

## Hard rules

1. **The downtime on screen is schematic.** The box is visibly down for about
   1.6s of video, and no seconds are shown on purpose. State the real figure in
   `header.stat` and `stat`, and keep it honest (a resize takes minutes, not
   hours).
2. **The caveat is per-request speed** or something as real (state has to live
   somewhere shared, more boxes cost more to run). Adding nodes does not make one
   request faster.

## Caption events

`saturate` (both sides full), `spawn` (the mint side adds a node), `offline`
(the amber box goes down), `online` (it comes back), `payoff`, `reset`. `token`
runs 1..35 in both cycles.

## Check still

`--frame=200` (cycle 1, box down, second node up, stat panel visible) and
`--frame=260` (after the payoff, credits visible).
