# Making a new reel

The procedure any agent follows to turn a topic into a finished reel. It is
the same whatever harness you run in (Claude Code, Codex, Cursor, Gemini CLI,
Aider, or a script). Every step is a file you read or a `reel` command you run
from the repo root.

`reel` is `./scripts/reel.mjs`, or `npm run reel -- <command>` if the shell
cannot execute it directly. Add `--json` to any command for machine-readable
output; every command exits non-zero on failure.

## Steps

1. **Read `prompts/author-scene.md` in full.** It has the shared rules and the
   reasons behind them. Most exist because breaking them produces a scene that
   validates and still looks wrong.

2. **Pick the archetype** whose claim IS the topic's argument:

   ```bash
   ./scripts/reel.mjs archetypes
   ```

   If none fits, say so, name the nearest framing an existing archetype could
   honestly carry, and stop before writing anything. Do not force a topic into
   an archetype that makes a different claim.

3. **Read that archetype's guide** (the `guide` path printed above), one of its
   reference scenes (`scenes/<reference>.json`), and its exact field caps:

   ```bash
   ./scripts/reel.mjs schema <kind>
   ```

4. **Write `scenes/<slug>.json`**, following the guide's hard rules. Content
   only: words and numbers. There are no fields for colour, font, size, border
   or position, and the look of every reel is fixed. Leave `handle` out; it
   comes from `reel.config.json`.

5. **Validate and iterate until it passes**, and, where the guide says so,
   until the printed budgets are under 90%:

   ```bash
   ./scripts/reel.mjs validate <slug> --json
   ```

   Each error has a `path` into your JSON and a `message` saying what to change.

6. **Render the check stills** and look at them if your harness can view
   images:

   ```bash
   ./scripts/reel.mjs still <slug>
   ```

   Check: nothing clipped, no text overlapping the diagram, the stat labels on
   one line each.

7. **Report** the archetype you chose and the captions as a list, so the argument
   of the reel can be reviewed without watching it. Render the MP4 only if you
   were asked to; it takes a few minutes:

   ```bash
   ./scripts/reel.mjs render <slug>
   ```

   This validates, builds the audio, asserts audio-visual sync, and writes
   `out/<slug>.mp4`.

## Scenes written elsewhere

If you wrote the JSON outside `scenes/`, install it first. `add` validates the
file and refuses to overwrite an existing slug without `--force`:

```bash
./scripts/reel.mjs add path/to/scene.json
```

## Constraints

- Never assign colours. Amber is the side being argued against, mint the one
  being argued for; you choose only which content goes where.
- `stat.lastText` states a genuine caveat, not a second win.
- Do not edit anything under `src/` to make a scene fit. A new archetype is a
  code change for a human to review, not part of authoring a reel.
