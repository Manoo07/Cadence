---
name: video-build
description: Build, validate, proof and render a Cadence video — the commands, the fix-and-retry loop, sourcing footage with yt-dlp, timing a script to a recording with Whisper, choosing a renderer, and what to do when a step fails. Use when running the pipeline, debugging a failed build or render, or iterating on a video that already has a script.
---

# Building a video

## The loop

```bash
pnpm cadence new <name>                  # scaffold
# edit projects/<name>/script.md
pnpm cadence voice <name> --mock-voice   # offline narration, no API spend
pnpm cadence build <name>                # -> video.json + mixed audio + .srt
pnpm cadence validate <name> --json      # structured report
pnpm cadence proof <name>                # one PNG per scene
# LOOK at projects/<name>/out/proof/*.png, fix the script, repeat
pnpm cadence voice <name>                # real ElevenLabs, once you are happy
pnpm cadence build <name>
pnpm cadence render <name>               # -> out/<name>.mp4
```

`pnpm cadence all <name> [--mock-voice]` chains voice → build → validate → render.

## Where the timings come from

Three sources, all producing the same `words.json`:

| Flag | Source | Use when |
| --- | --- | --- |
| *(none)* | ElevenLabs `with-timestamps` | Synthesising narration. Exact, free with the call, cached. |
| `--mock-voice` | macOS `say` + estimated timings | Iterating on layout. No API key, no spend. |
| `--audio <file>` | Whisper via faster-whisper | A human recording, or audio pulled from a video. |

With `--audio`, Whisper transcribes and the timings are transferred onto the
script by sequence alignment. The command reports coverage — the share of
script words that matched the transcript. Above ~90% is healthy. Below ~75% it
warns, and the usual causes are the recording not matching the script, or a
model too small for the audio: try `--whisper-model small`.

## Footage

```bash
pnpm cadence fetch <name> <url>                        # b-roll, normalised to the frame
pnpm cadence fetch <name> <url> --section '*01:10-01:25'
pnpm cadence fetch <name> <url> --fit blur             # blurred margins, not bars
pnpm cadence fetch <name> <url> --audio-only           # soundtrack only
```

Clips land in `public/footage/`, already scaled, cropped and muted. Reference
one with `:: footage { src: "footage/clip.mp4" }`.

`--audio-only` plus `voice --audio` is how you re-cut an existing video: take
its soundtrack, write a script against it, and let Whisper do the timing.

## Renderers

```bash
pnpm cadence render <name>                        # Remotion (default)
pnpm cadence render <name> --renderer hyperframes
```

Both read the same `video.json`. Remotion is the default and renders the full
layout catalog. HyperFrames renders plain HTML with a GSAP timeline — reach for
it for native video clips, AWS Lambda rendering, or when Remotion's bundled
Chrome will not start. It is a reduced rendering, so anything that must look
exactly right goes through Remotion.

## Work offline until the end

`--mock-voice` synthesises narration locally with macOS `say` and estimated
timings. It costs nothing and is close enough to judge pacing and layout. Only
run real synthesis once the proof sheet looks right — and it is cached on a hash
of (text, voice, model), so re-running after a layout change is free.

## Always look at the proof sheet

`pnpm cadence proof <name>` renders one still per scene, a third of the way in.
Read those images. It is the only way to see what the script produced, and it
is far cheaper than a full render. Judge:

- Does anything overflow or collide?
- Is anything hidden behind the caption zone (bottom ~560px at 9:16)?
- Is the scene too busy to read in the seconds it is on screen?
- Do consecutive scenes look too alike?

## Validation is a fix-and-retry loop

`pnpm cadence validate <name> --json` returns structured issues, each with a
`code`, `scene`, `path` and `hint`. Fix them in `script.md`, re-run `build`,
re-run `validate`. Errors block a render; warnings do not but usually should be
fixed.

| Code | Meaning |
| --- | --- |
| `layout.unknown` | Layout not in the registry — check `pnpm cadence catalog`. |
| `props.invalid` | Props failed the layout's schema. The path says which prop. |
| `props.invalid-json` | Script syntax. Usually single quotes; use double. |
| `text.overflow` | A string will not fit its box. The hint gives the budget. |
| `density.overloaded` | Too many elements for the time available. Cut or split. |
| `pacing.rushed` | Above ~4 words/sec. Shorten the line or split the scene. |
| `pacing.scene-too-short` | Under 1.2s. Lengthen narration or add `> hold: 800`. |
| `pacing.scene-too-long` | Over 14s. One visual held that long goes flat. |
| `custom.unregistered` | Component not registered in `scenes/index.ts`. |
| `asset.missing` | Referenced image or music not found. |

## Troubleshooting

**`No voiceover yet`** — run `voice` before `build`. The build needs word
timings to place scenes.

**Scene timings look wrong** — they are derived from the voiceover, so they are
wrong only if the narration is wrong. Check the script, not the spec. Never
hand-edit frame numbers in `video.json`; the next build overwrites them.

**Render fails to launch a browser** — Remotion needs headless Chrome.
`npx remotion browser ensure` installs it. If its bundled
`chrome-headless-shell` will not start, the CLI falls back to a system Chrome
automatically; override with `VIDEO_BROWSER_EXECUTABLE`. Failing that,
`--renderer hyperframes` uses a different browser stack entirely.

**Whisper or yt-dlp missing** — run `./scripts/setup-media.sh`. Both live in
`.venv-media/`, isolated from the system Python.

**Low Whisper coverage** — the recording and the script have drifted apart.
Check they actually match, then try a larger `--whisper-model`. The timeline
still builds: unmatched words are interpolated between their neighbours.

**Fonts look wrong** — `src/video/Root.tsx` loads explicit weights. A weight
used in a style pack but not loaded there falls back silently.

**Audio drifts from the visuals** — it should not. Scene durations are
compensated for transition overlap in `src/video/Video.tsx`; if drift appears,
that arithmetic is the place to look, not the scene components.

## Editing the spec directly

`video.json` is readable and hand-editable for a one-off tweak, but `build`
regenerates it from `script.md`. Durable changes belong in the script.
