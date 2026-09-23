# `pipeline`

**Claim:** one path, and one stage in it eats the time. Fix that stage and the
whole path shrinks.

**Picture:** a waterfall. One row per stage, each bar starting where the previous
one ended, a playhead sweeping across and an elapsed clock counting. The
bottleneck bar is amber and visibly huge. On the payoff cycle the same path runs
with the bottleneck fixed: its bar shrinks, a dashed ghost shows where it used to
end, everything after it moves left and the clock stops early. The soundtrack
follows the weights: a thud entering the bottleneck, quiet ticks inside it, a
whoosh when the request gets out.

**Reference:** `scenes/cold-start.json`.

## Use it for

- request lifecycle (DNS, TLS, server, render)
- serverless cold starts
- CI runs (checkout, install, build, test, deploy)
- query plans (a seq scan dominating)
- page load waterfalls

## Do not use it for

A two-way comparison of whole approaches (that is `splitCompare`), or a path
where the time is spread evenly: with no dominant stage there is no argument.

## Which side is which

There is one path. The `bottleneck: true` stage is amber (argued against); every
other stage, and the fixed bottleneck, are mint.

## Fields

- `stages`: 3 to 5, each `{ name, detail, cost, weight, bottleneck? }`.
  `cost` is the label shown at the end of the bar, e.g. `"840ms"`.
- `totalMs`: the real duration of the whole unfixed path. The elapsed clock
  counts up to it.
- `fix`: `{ weight, cost, label }`, the bottleneck once fixed. `label` names
  the fix, e.g. `"KEPT WARM"`, and sits above the ghost bar.

## Hard rules

1. **Weights sum to exactly 100**, each at least 4.
2. **Exactly one bottleneck**, and it is the heaviest stage.
3. **`fix.weight` is below the bottleneck's weight.** The fixed path's total is
   `100 - bottleneck.weight + fix.weight`; `npm run validate` prints it.
4. **Make the numbers agree.** Each `cost` should be about `totalMs * weight / 100`,
   `fix.cost` about `totalMs * fix.weight / 100`, and `stat.firstBefore` /
   `stat.firstAfter` the two totals. Validation does not parse these strings, so
   check them by hand.

## Caption events

`bottleneck` (the request enters it), `done` (the request comes out the far
end; earlier in cycle 1), `payoff`, `reset`. `token` counts clock ticks: 1..30 in
cycle 0, fewer in cycle 1 (validation tells you how many).

## Check still

Pick a frame just after cycle 1's `payoff`, e.g. `--frame=250`: every bar filled,
the ghost visible, the fixed total marked on the axis, the stat strip on one line.
