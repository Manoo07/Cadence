---
name: video-script
description: Write or revise a script.md for Cadence — the narrated, captioned explainer video format. Use when the user wants a new video, a script for a video, or changes to an existing video's script. Covers the scene syntax, pacing rules, and how narration drives timing.
---

# Writing a video script

A script is the whole input. Scene durations, caption timing and visual accents
are all derived from the narration, so the script is not a storyboard with text
attached — it is the source of truth.

## Format

```md
---
title: What is RAG?
voice: elevenlabs:Rachel
style: paper-vector
format: 9x16
captions: selection
music: music/calm.mp3          # optional, relative to assets/
---

## 01 — the problem
:: title { text: "Every company wants its own AI" }
Every company wants its **own AI**. Not a chatbot — something that knows their business.

## 02 — retrieval
:: pipeline { steps: ["SPLIT","EMBED","STORE","RETRIEVE"], active: 3 }
> transition: slide
So before **every** answer, it looks things up.
```

| Line | Meaning |
| --- | --- |
| `## <label>` | Starts a scene. The label renders top-left as `// <label>`. |
| `:: layout { props }` | What is on screen. Run `pnpm cadence catalog` for the full list. |
| `> key: value` | Scene options: `transition`, `transitionMs`, `hold`, `camera`. |
| plain text | The narration. This is what gets spoken. |
| `**word**` | An emphasis beat — visuals land on that spoken word. |

Props are JSON with unquoted keys allowed. Use double quotes for strings, never single.

## Rules that matter

**Never set scene durations.** They are measured from the voiceover. A scene
lasts exactly as long as its narration takes to speak.

**One idea per scene.** Target 5–8 seconds, which is roughly 12–20 spoken words.
If a scene needs two sentences of setup plus a conclusion, it is two scenes.

**Write the narration first, then choose the layout.** The layout illustrates
what is being said; picking it first leads to scripts written to fit a picture.

**Name every section on screen.** If the script works through a numbered list —
seven failures, five steps, three options — each scene must say which one it
is, with `eyebrow` for the number and `headline` for the name:

```md
:: code { eyebrow: "problem 02", headline: "Truncated file", ... }
```

Narration alone does not do this. Someone who looks up three seconds late has
no idea whether this is problem two or problem five, and the video stops
feeling structured and starts feeling like someone reading aloud. The viewer
should be able to pause on any frame and know exactly where they are.

**Mark one emphasis per scene, at most two.** `**bold**` is a beat the visuals
snap to. Marking five words in a sentence means marking nothing.

**Speak, do not write.** Contractions, short sentences, em-dashes. Read it aloud;
if you run out of breath, it is too long.

**Keep text on screen short.** A `title` fits about 8 words. Badges and mono
labels must fit on one line. The validator will catch overflow, but writing
short avoids the round trip.

## Pacing a whole video

- Under 2 minutes total. Vertical viewers leave.
- Open with the problem, not the definition. The first 3 seconds decide retention.
- Use a `stack` as the spine when explaining a system: pass the full item list
  every scene, advance `active`, and raise `revealed` as pieces are introduced.
  The viewer sees the model being assembled.
- Vary the layout. Three `stage` scenes in a row read as a slideshow.
- End on a statement, not a summary.

## Writing to existing audio

If there is already a recording — a human voiceover, or the soundtrack of a
video pulled with `video fetch <name> <url> --audio-only` — write the script to
match what is said, then:

```bash
pnpm cadence voice <name> --audio public/source-audio.mp3
```

Whisper supplies the timings. The narration in your script should match the
recording closely; it does not have to match perfectly, because the words are
aligned rather than zipped, but coverage below ~75% means they have drifted far
enough that most timings are guesses.

## After writing

```bash
pnpm cadence voice <name> --mock-voice   # offline, no API spend
pnpm cadence build <name>
pnpm cadence validate <name> --json      # fix anything it reports
pnpm cadence proof <name>                # then LOOK at projects/<name>/out/proof/*.png
```

Always read the proof images before rendering. They are the only way to see
what the script actually produced.
