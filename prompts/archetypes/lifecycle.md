# `lifecycle`

**Claim:** a pooled resource has to come back. Skip the release and it parks in
one state until the pool runs dry.

**Picture:** a closed loop. The pool (six slots) sits at the top centre; a leg
runs down into the first state, the states sit in a row, and a leg runs back up
from the last state into the pool. A request arrives every 300ms and borrows a
slot. On the leaking cycle every resource stops in `stuckState` and piles up
there (amber), the return leg stays dark, the pool empties on the seventh
request (a low thud) and every request after it waits. On the fixed cycle the
`fixLabel` appears on that state, each resource runs the whole loop and drops
back into its slot with a small chime, and the pool never empties under the same
traffic.

**Reference:** `scenes/connection-leak.json`.

## Use it for

- database connections never returned to the pool
- sockets piling up in TIME_WAIT
- file descriptors never closed
- locks or semaphores never released
- goroutines or threads never joined

## Do not use it for

One slow step (that is `pipeline`), or running out of capacity with nothing
leaking (that is `scaleOut`: the fix there is more capacity, here it is giving
back what you took).

## Which side is which

The leaking cycle is amber (argued against), the fixed loop is mint (argued
for). Resources in motion and the healthy states are ice blue.

## Fields

- `pool`: `{ label, sub }` above the slots, e.g. `"CONNECTION POOL"`,
  `"6 connections, shared"`. The pool always has 6 slots and there are always
  10 requests, so say 6 if you give a number.
- `states`: 3 to 5, each `{ name, detail }`, in the order a resource passes
  through them. The last one should be the release (e.g. `"CLOSED"`,
  `"RELEASED"`). `detail` wraps to two lines under the box.
- `stuckState`: index of the state it never leaves when leaking. Its `detail`
  should say why, e.g. `"read, but never closed"`.
- `fixLabel`: what makes it leave, e.g. `"defer close()"`, `"with pool:"`.
- `freeLabel` / `waitLabel`: the two counters, e.g. `"FREE CONNS"`, `"WAITING"`.

## Hard rules

1. **The on-screen numbers are fixed:** 10 requests, a pool of 6, so 6 served
   and 4 blocked on the leaking cycle, and all 10 served on the fixed one. If
   `header.stat` or `stat` quote counts, use these; if they quote the real
   figures of your topic, make sure they are real.
2. **The caveat is a real limit**: the pool size itself (`6 = 6`: the fix frees
   no extra capacity), or that the release still has to happen on every error
   path.

## Caption events

`stuck` (the first resource reaches the stuck state), `exhausted` (the pool
runs dry on the leaking cycle; on the fixed cycle, the same moment, when it
does not), `release` (the first resource would come home), `payoff`, `reset`.
Events land at the same moment on both cycles. `token` counts requests, 1..10,
one every 300ms: the reel opens 12 frames in, so anchor the first caption at
`token` 3 or later.

## Check still

`--frame=72` (leaking cycle: the pile in the stuck state, the empty pool, the
blocked requests) and `--frame=250` (fixed cycle after the payoff: the fix label,
the closed loop, the stat strip on one line).
