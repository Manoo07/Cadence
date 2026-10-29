# Cadence — working notes

A script-to-video framework: the voice sets the rhythm, and every frame number
is measured from it. Read `README.md` first for the shape of it.

## Skills

Three skills in `.claude/skills/` cover this project. Load the relevant one
before working:

- **video-script** — writing or revising a `script.md`
- **video-direct** — choosing layouts and props
- **video-build** — running the pipeline, footage, Whisper, renderers, debugging

## Toolchain

`./scripts/setup-media.sh` installs Whisper and yt-dlp into `.venv-media/`,
isolated from system Python. ffmpeg and uv must already be present.

## Rules

**`src/core/` is pure.** No IO, no React, no `Date.now`, no unseeded randomness,
and no renderer. It returns `Result` and never throws. If a change to core needs
the filesystem, it belongs in `src/cli/` instead.

**Anything both renderers must agree on lives in core.** Caption paging is the
worked example: it sits in `core/captions.ts` precisely so Remotion and
HyperFrames break lines identically. A caption that reads differently depending
on which renderer produced the file is a caption you cannot trust.

**Never author scene durations.** They are derived from the voiceover alignment.
Hand-editing frame numbers in `video.json` works once and is overwritten by the
next `build`.

**Scenes read tokens, not constants.** No hard-coded colour, size, radius or
spring in `src/scenes/`. If a value is missing, add it to `src/kit/tokens.ts`
and the style pack.

**Props are content.** A layout's schema describes what is on screen, never how
it moves or what colour it is. This is what keeps the catalog writable by a
model.

**Work with `--mock-voice` until the end.** Real synthesis costs money. The
mock runs the whole pipeline offline.

**Never zip a transcript against a script.** Whisper reports what it heard, not
what was written. Timings are transferred through the sequence alignment in
`core/transfer.ts`; pairing the two lists index-by-index desynchronises
everything after the first mishearing.

**Look at the proof sheet before rendering.** `pnpm cadence proof <name>` writes a
PNG per scene. Read them. Rendering without looking wastes minutes and ships
mistakes.

## Verifying a change

```bash
pnpm test        # pure core — must stay green
pnpm typecheck
pnpm cadence all demo --mock-voice
pnpm cadence render demo --renderer hyperframes   # if you touched core or captions
```

Touching captions, timing or the spec shape affects both renderers. Check both.
