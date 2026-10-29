# Making a video with Cadence

A practical guide to going from an idea to a finished vertical video.

If you only remember one thing: **everything is free until you run
`cadence final`.** Draft as many times as you like.

---

## Before you start

```bash
pnpm install                # the pipeline
./scripts/setup-media.sh    # Whisper + yt-dlp, isolated venv
cp .env.example .env        # paste your ElevenLabs key into it
```

You need `node 22+`, `ffmpeg`, and `uv`. Check what you have to spend:

```bash
pnpm cadence quota
```

```
ElevenLabs
  10,000 of 10,000 characters left (100%, free) · resets 29 Nov

  my-video          1,400 chars  ·  7 more run(s)
```

ElevenLabs bills **per character of narration**. A 90-second video is roughly
1,400 characters, so the free tier is about seven finished videos a month.
That is why drafting is free and finishing is deliberate.

---

## The loop

```
   new ──▶ write script ──▶ voice ──▶ build ──▶ validate ──▶ proof
                 ▲                                             │
                 └──────────── look, fix, repeat ──────────────┘
                                                               │
                                                        final ─┘   ← spends
```

Steps one to six cost nothing and run offline. Only `final` touches your quota.

---

## 1. Start a project

```bash
pnpm cadence new my-video
```

This creates `projects/my-video/` with a `script.md` you edit, a `public/`
folder for images and clips, and a `scenes/` folder for custom components.

## 2. Write the script

Open `projects/my-video/script.md`. The format is small on purpose:

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

| Line | What it is |
| --- | --- |
| `## 01 — the problem` | A new scene. The text shows top-left as `// 01 — the problem`. |
| `:: title { ... }` | What is on screen. `pnpm cadence catalog` lists all 16 layouts. |
| `> transition: slide` | Options: `transition`, `hold`, `camera`. |
| Plain text | The narration. This is what gets spoken. |
| `**own AI**` | An emphasis beat — the visuals land on that spoken word. |

**You never set scene durations.** They are measured from the voiceover. Write
the words; the timing follows.

### Writing for short-form

- **Open with the problem, not the definition.** The first three seconds decide
  whether anyone sees the fourth.
- **One idea per scene.** Five to eight seconds, which is twelve to twenty
  spoken words. Two sentences of setup plus a conclusion is two scenes.
- **Write it to be spoken.** Contractions, short sentences. Read it aloud — if
  you run out of breath, it is too long.
- **Name every section on screen.** Working through a numbered list? Each scene
  gets `eyebrow: "problem 03"` and `headline: "Full scan"`. A viewer who looks
  up late must still know where they are. Without this the video sounds like
  someone reading a page aloud.
- **Mark one emphasis per scene.** `**bold**` is a beat the visuals snap to.
  Marking five words in a sentence marks nothing.
- **Keep under two minutes.** Vertical viewers leave.
- **Vary the layout.** Three `stage` scenes in a row is a slideshow.
- **End on a statement, not a summary.**

### The one layout worth learning

`stack` holds a list that grows across scenes. Pass the whole list every time
and move `active` and `revealed`:

```md
## 03 — the model
:: stack { items: ["MODEL","SYSTEM PROMPT","RAG"], revealed: 1, active: 0 }

## 04 — the prompt
:: stack { items: ["MODEL","SYSTEM PROMPT","RAG"], revealed: 2, active: 1 }
```

The viewer watches the system assemble instead of being shown a finished
diagram. It is what turns a list of topics into an argument.

## 3. Draft it — free

```bash
pnpm cadence voice my-video     # offline narration, no spend
pnpm cadence build my-video     # script -> video.json, audio mix, .srt
```

`voice` uses an offline stand-in voice by default. It sounds robotic; that is
fine. It gives you real word timings so the pacing is honest.

## 4. Check it

```bash
pnpm cadence validate my-video
```

Fix anything it reports. It catches what you cannot see from the script: text
that will overflow, content hidden behind the captions, scenes too dense to
read in the time available, narration going too fast.

```bash
pnpm cadence proof my-video
```

This renders **one PNG per scene** into `projects/my-video/out/proof/`.

**Open them.** This is the most useful habit in the whole workflow. Ask:

- Does anything overflow, collide, or sit under the captions?
- Is the scene readable in the seconds it is on screen?
- Do consecutive scenes look too similar?

Fix the script, re-run, look again. All free.

## 5. Watch the draft

```bash
pnpm cadence render my-video
```

A full MP4 with the draft voice. Pacing, transitions and captions are all real
— only the voice is a stand-in. This is your last free check.

## 6. Finish it — this spends

```bash
pnpm cadence final my-video
```

```
Finalising "my-video"
▸ Checking the draft first…
✓ Draft is renderable.
▸ Narrating 264 words with ElevenLabs…

  This run costs 1,400 characters.
  You have 10,000 of 10,000 characters left (100%, free) · resets 29 Nov
  After this run: 8,600 characters left.

  Spend them? [y/N]
```

`final` validates the draft **before** buying anything, so a broken script
costs you nothing. It then shows the exact cost, asks, and only then
synthesises, rebuilds and renders.

Answer `n` and nothing is spent. Pass `--yes` to skip the prompt in a script.

Your video is at `projects/my-video/out/my-video.mp4`, with captions beside it
as `.srt`.

---

## Protecting your quota

| | |
| --- | --- |
| Everything except `final` is free | Draft and proof as much as you like |
| `final` validates first | A broken script never costs characters |
| It always asks | Unless you pass `--yes` |
| Identical text is cached | Re-finalising an unchanged script is free |
| Non-interactive runs decline | A CI job cannot silently drain your month |

Check anytime with `pnpm cadence quota`.

**The cache is keyed on the exact narration text.** Change one word and the
whole script is re-synthesised at full cost. So do your editing in draft, and
finalise once.

---

## Using your own voice

You do not have to synthesise at all. Record the narration, then:

```bash
pnpm cadence voice my-video --audio recording.mp3
```

Whisper listens and works out the timing. It reports coverage — how much of
your script it matched. Above 90% is healthy; below 75% means the recording and
the script have drifted apart.

This costs no ElevenLabs characters at all.

## Adding footage

```bash
pnpm cadence fetch my-video "https://..." --section '*01:10-01:25'
```

The clip is downloaded, trimmed, scaled and cropped to your frame, and muted —
the narration owns the audio. Then:

```md
## 07 — see it
:: footage { src: "footage/clip.mp4", headline: "This is what it looks like" }
```

Use `--fit blur` when a landscape clip has to live in a vertical frame and you
would rather have blurred margins than black bars.

A clip earns its place when it shows something a drawing cannot. Stock b-roll
dropped in because a scene feels empty makes the video look like an advert.

---

## Changing the look

Everything visual comes from one file: `src/kit/styles/paper-vector.ts`.
Colours, type scale, stroke width, corner radius, spring physics, grain. Change
a value there and every scene in every project follows.

To make a second look, copy that file, rename it, register it in
`src/kit/styles/index.ts`, and name it in your script's frontmatter:

```md
style: my-style
```

## Other formats

```md
format: 16x9     # or 1x1
```

Layouts scale from a 1080-wide reference grid and respect per-format safe
areas, so this is a one-line change rather than a redesign.

---

## When something goes wrong

| What you see | What to do |
| --- | --- |
| `No voiceover yet` | Run `voice` before `build`. |
| `layout.unknown` | Check `pnpm cadence catalog`. |
| `props.invalid-json` | Script syntax — usually single quotes. Use double. |
| `text.overflow` | Shorten it. The hint tells you the budget. |
| `density.overloaded` | Too much on screen for the time. Cut items or split the scene. |
| `pacing.rushed` | Above ~4 words/sec. Shorten the line. |
| Timings look wrong | They come from the audio — fix the script, not `video.json`. |
| Browser will not launch | `npx remotion browser ensure`, or `--renderer hyperframes`. |
| Whisper/yt-dlp missing | `./scripts/setup-media.sh` |

`video.json` is regenerated by every `build`, so edit `script.md` — not the
spec.

---

## Command reference

**Free, offline, run as often as you like**

| Command | What it does |
| --- | --- |
| `cadence new <name>` | Scaffold a project |
| `cadence voice <name>` | Draft narration + word timings |
| `cadence build <name>` | Compile the script, mix audio, emit `.srt` |
| `cadence validate <name>` | Report problems (`--json` for tooling) |
| `cadence proof <name>` | One still per scene |
| `cadence preview <name>` | Open Remotion studio |
| `cadence render <name>` | Render the MP4 |
| `cadence all <name>` | The four above, in order |

**Spends ElevenLabs characters**

| Command | What it does |
| --- | --- |
| `cadence final <name>` | Validate, buy the real voice, render |
| `cadence voice <name> --real` | Just the narration step |

**Other**

| Command | What it does |
| --- | --- |
| `cadence quota` | Characters left, and what that buys |
| `cadence fetch <name> <url>` | Pull footage or audio |
| `cadence catalog` | List the 16 layouts |
| `cadence list` | List projects |

**Flags:** `--real` · `-y, --yes` · `--audio <file>` · `--whisper-model <size>`
· `--renderer remotion\|hyperframes` · `--audio-only` · `--section <range>` ·
`--fit cover\|contain\|blur` · `--json`
