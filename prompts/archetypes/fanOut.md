# `fanOut`

**Claim:** independent calls. Made one after another you wait for the sum of
them; fanned out you wait only for the slowest.

**Picture:** two waterfalls on one shared time axis. The top lane (amber) makes
each call only after the previous one returns, so its bars stack end to end
across the whole axis. The bottom lane (mint) fires every call at zero; a hard
join line drops where the slowest returns. Two elapsed clocks count together;
the mint one stops at the join, the amber one keeps going. You hear it: a bright
accent at the join, then quieter ticks while only the sequential lane is still
waiting, and a whoosh when it finally finishes.

**Reference:** `scenes/promise-all.json`.

## Use it for

- `Promise.all` / `asyncio.gather` vs awaiting in a loop
- parallel API calls on page load
- scatter-gather queries across shards
- splitting a test suite across runners

## Do not use it for

Calls that depend on each other's results (that is `pipeline`: a chain, where the
question is which step eats the time), or a set where one call dwarfs the rest:
if the slowest is most of the total, fanning out barely helps and the reel is
dishonest. The schema caps any one call at 60% for that reason.

## Which side is which

- `seq`: amber, one after another (argued against)
- `par`: mint, all at once (argued for)

## Fields

- `calls`: 3 to 5, each `{ name, cost, weight }`, in the order the sequential
  lane makes them. `name` is short, e.g. `"GET /user"`. `cost` is the label at
  the end of each bar.
- `totalMs`: the real duration of all the calls in turn. Both clocks count on
  this scale.
- `par.join`: what waits for them all, shown on the join line, e.g.
  `"ALL RESOLVED"`, `"GATHER"`.
- `clockLabel`: above both clocks, e.g. `"ELAPSED"`.

## Hard rules

1. **Weights sum to exactly 100**, each between 8 and 60.
2. **Make the numbers agree.** Each `cost` should be about
   `totalMs * weight / 100`. `stat.firstBefore` is `totalMs`; `stat.firstAfter` is
   the slowest call's cost. `npm run validate` prints both; check them by hand.
3. **The caveat is the slowest call**, or something as real (the downstream
   service now takes the whole burst at once, a rate limit bites). Fanning out
   makes no single call faster.

## Caption events

`join` (the slowest parallel call returns; the mint clock stops), `done` (the
sequential lane finishes), `payoff`, `reset`. `token` runs 1..30 in both
cycles.

## Check still

`--frame=60` (cycle 0, just after the join: the mint lane finished, the amber lane
still going) and `--frame=250` (after the payoff: both finish lines, the stat
strip on one line).
