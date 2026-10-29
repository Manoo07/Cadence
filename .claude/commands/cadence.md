---
description: Create, build or render a Cadence video from a topic or script
---

Make a video with Cadence.

Argument: $ARGUMENTS — a topic, a project name, or a request.

1. If this is a new video, invoke the `video-script` skill and write
   `projects/<name>/script.md`. Use `video-direct` to choose layouts.
2. Run the offline pipeline:
   `pnpm cadence voice <name> --mock-voice && pnpm cadence build <name>`
3. `pnpm cadence validate <name> --json` — fix every error, then re-run.
4. `pnpm cadence proof <name>` — then **read the PNGs** in
   `projects/<name>/out/proof/` and judge them honestly. Fix and repeat.
5. Only when the proof sheet is good, offer the real render:
   `pnpm cadence voice <name> && pnpm cadence build <name> && pnpm cadence render <name>`

Never skip step 4. Rendering without looking is how bad videos get shipped.
