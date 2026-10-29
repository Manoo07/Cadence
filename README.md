# Cadence

**A script goes in. A narrated, captioned, animated MP4 comes out.**

Cadence is the rhythm of speech — and here it is the rhythm of the whole video.
The voice arrives first, and the picture is assembled to match it. Scene cuts,
caption timing and visual accents are all measured from the audio, never
authored by hand. Edit a line of narration and every frame downstream moves.

Built for educational explainers in the style of vertical social video — flat
vector art, word-level captions, a concept that assembles itself across scenes.
Designed so that Claude, or any AI tool, can drive the whole pipeline from a
script, look at what it produced, and fix its own mistakes.

```bash
pnpm install
./scripts/setup-media.sh        # Whisper + yt-dlp, in an isolated venv
cp .env.example .env            # add ELEVENLABS_API_KEY (optional to start)

pnpm cadence new my-video
# edit projects/my-video/script.md
pnpm cadence all my-video --mock-voice
```

## The idea

**Scene durations are never authored. They are measured from the voiceover.**

ElevenLabs' `with-timestamps` endpoint returns a timing for every *character*
of the text it was given. The parser records which characters belong to which
scene, so one TTS call yields three things at once:

- **scene cuts** — each scene runs until the next one's first word is spoken
- **caption timing** — word-level, exact, no forced aligner
- **emphasis beats** — `**marked**` words become frames the visuals snap to

Edit a line of narration and every downstream frame number moves to match. There
is nothing to re-sync, because nothing was ever synced by hand.

**Any audio works, not just synthesised audio.** Point `--audio` at a recording
and Whisper supplies the timings instead. Because Whisper reports what it
*heard* rather than what the script says, its words are aligned back onto the
script with a Needleman-Wunsch pass and the timings transferred across matched
pairs — so a mishearing costs you one interpolated word instead of
desynchronising everything after it. The script stays the source of truth for
*what* is on screen; the audio decides *when*.

## Pipeline

```
script.md ──parse──▶ Script (+ character offsets)
                        │
                        ├─narration──▶ ElevenLabs ──▶ audio + char alignment
                        │                                    │
                        │                               fold to words
                        ▼                                    ▼
                   layout + props ◀────── scene timings / emphasis beats
                        │
                        ▼
                   video.json ──▶ validate ──▶ proof PNGs ──▶ Remotion ──▶ mp4 + srt
                                     ▲                           │
                                     └───── read, fix, repeat ───┘
```

## Commands

| Command | Does |
| --- | --- |
| `video new <name>` | Scaffold a project |
| `video voice <name>` | Narration + word timings (synthesised, or Whisper on a recording) |
| `video fetch <name> <url>` | Pull footage or audio with yt-dlp, normalised to the frame |
| `video build <name>` | `script.md` → `video.json`, mix audio, emit `.srt` |
| `video validate <name>` | Structured report of everything wrong (`--json`) |
| `video proof <name>` | One still per scene, to look at before rendering |
| `video preview <name>` | Open Remotion studio |
| `video render <name>` | Render the MP4 |
| `video all <name>` | voice → build → validate → render |
| `video catalog` | List the layouts a script can use (`--json`) |

```
--mock-voice             offline narration; no API key, no spend
--audio <file>           time the script to an existing recording (Whisper)
--whisper-model <size>   tiny | base | small | medium | large-v3   (default base)
--renderer <name>        remotion (default) | hyperframes
--audio-only             fetch: take the soundtrack only
--section <range>        fetch: trim, e.g. '*00:01:10-00:01:25'
--fit <mode>             fetch: cover (default) | contain | blur
--json                   machine-readable output
```

`--mock-voice` runs the whole pipeline offline with no API key and no spend.

## Script format

```md
---
title: What is RAG?
voice: elevenlabs:Rachel
style: paper-vector
format: 9x16
---

## 01 — the problem
:: title { text: "Every company wants its own AI" }
Every company wants its **own AI**. Not a chatbot — something that knows their business.

## 02 — retrieval
:: pipeline { steps: ["SPLIT","EMBED","STORE","RETRIEVE"], active: 3 }
> transition: slide
So before **every** answer, it looks things up.
```

`##` scene · `::` layout + props · `>` options · body is narration ·
`**bold**` is an emphasis beat.

## Layouts

`title` `stage` `split` `stack` `pipeline` `diagram` `compare` `device` `chat`
`code` `stat` `quote` `grid` `bubbles` `footage` `custom`

`pnpm cadence catalog` prints what each is for and an example. `stack` is the one
worth knowing: it holds a list that grows across scenes, so the viewer watches a
system being assembled rather than being shown a finished diagram.

When nothing fits, write a React component in `projects/<name>/scenes/`,
register it, and reference it with `:: custom { component: "Name" }`.

## Working with footage

```bash
pnpm cadence fetch my-video "https://..."                     # b-roll, normalised to the frame
pnpm cadence fetch my-video "https://..." --section '*01:10-01:25'
pnpm cadence fetch my-video "https://..." --audio-only        # just the soundtrack
```

Clips land in `public/footage/` already scaled, cropped and muted, ready for
`:: footage { src: "footage/clip.mp4" }`. `--fit blur` fills the margins of a
landscape clip with a blurred copy rather than bars.

`--audio-only` is how you re-cut an existing video: pull its soundtrack, write a
script against it, then `video voice <name> --audio public/source-audio.mp3`.

## Two renderers

Both read the same `video.json`, which is renderer-agnostic data.

| | |
| --- | --- |
| **Remotion** (default) | React scenes, the full layout catalog, the design you see in the examples |
| **HyperFrames** | Plain HTML + GSAP. Native `<video>` clips, AWS Lambda rendering, and a way through when Remotion's bundled Chrome will not start |

```bash
pnpm cadence render my-video --renderer hyperframes
```

The HyperFrames backend is a reduced rendering, not a second implementation of
every layout — keeping two pixel-identical versions of fifteen layouts would be
two sources of truth for one design. Scenes that must look exactly right go
through Remotion.

## Architecture

```
src/core/       PURE — types, parser, alignment, timing transfer, caption paging,
                compiler, validator. No IO, no React, no renderer.
src/voice/      ElevenLabs + content-hash cache + offline mock + Whisper
src/media/      yt-dlp sourcing, ffmpeg footage prep
src/audio/      ffmpeg mix: sidechain ducking, derived sound cues
src/kit/        design system — tokens, style packs, motion, primitives
src/scenes/     the layout registry
src/captions/   caption themes
src/video/      Remotion composition
src/renderers/  HyperFrames HTML backend
src/cli/        the imperative shell
scripts/        python sidecars (whisper) and setup
```

`src/core` never throws, never touches the filesystem, and is fully unit-tested
(`pnpm test`). Everything that can go wrong at runtime goes wrong at the edges.

## Making it your own

**Change the look** — edit `src/kit/styles/paper-vector.ts`, or add a pack
beside it and name it in a script's frontmatter. Scenes read every colour, size
and spring from tokens, so the whole video restyles at once.

**Change the format** — `format: 16x9` or `1x1` in frontmatter. Layouts scale
from a 1080-wide reference grid and respect per-format safe areas.

**Add a layout** — one file in `src/scenes/`, one line in `registry.ts`. The
catalog, the JSON schema and the validator all derive from that list.

## Requirements

| | |
| --- | --- |
| Node 22+, pnpm | the pipeline and both renderers |
| ffmpeg | audio mixing, footage prep, Whisper decoding |
| uv | installs the media venv (`./scripts/setup-media.sh`) |
| faster-whisper | word timings for non-synthesised audio |
| yt-dlp | sourcing footage |
| macOS `say` | `--mock-voice` only; silence is used as a fallback elsewhere |

Remotion needs headless Chrome: `npx remotion browser ensure`. If its bundled
`chrome-headless-shell` will not start, the CLI falls back to a system Chrome
automatically — override with `VIDEO_BROWSER_EXECUTABLE`.
