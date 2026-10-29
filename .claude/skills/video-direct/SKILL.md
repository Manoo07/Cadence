---
name: video-direct
description: Choose layouts and props for a Cadence video — the catalog of scene layouts, what each is for, and the props each accepts. Use when writing or revising the `:: layout { ... }` directives in a script.md, or when deciding how to show something on screen.
---

# Directing a scene

Every scene names one layout and fills its props. The layout decides the
arrangement and the motion; the props are only ever *content*. There is no way
to express timing or styling in props, and that is deliberate — it is what keeps
twenty scenes looking like one video.

Run `pnpm cadence catalog --json` for the machine-readable version of this list.

## Choosing

| If the narration is… | Use |
| --- | --- |
| a statement, an opener, a turn | `title` |
| about one object | `stage` |
| showing a thing and annotating it | `split` |
| building a system piece by piece | `stack` |
| walking an ordered process | `pipeline` |
| about how parts connect | `diagram` |
| A versus B | `compare` |
| a product surface — email, CLI, app | `device` |
| dialogue or an exchange | `chat` |
| a prompt, config, log, command | `code` |
| a figure worth weight | `stat` |
| a claim you are about to dismantle | `quote` |
| an unordered set of things | `grid` |
| many voices at once | `bubbles` |
| something real that a drawing cannot carry | `footage` |
| none of the above | `custom` |

## The catalog

### `title`

A full-frame statement, set large.

**Use when:** Opening, closing, or a hard pivot in the argument. One idea only.

```
:: title { text: "Every company wants its own AI", eyebrow: "01 · the problem" }
```

### `stage`

One centred subject with an optional headline and caption.

**Use when:** The default. Use when a scene is about a single thing and needs no structure.

```
:: stage { headline: "Meet Nova", glyph: "🤖", caption: "Your support agent" }
```

### `split`

A visual beside or above a short list of points.

**Use when:** You need to show something AND annotate it. For A-vs-B, use `compare` instead.

```
:: split { headline: "What changed", bullets: ["No retraining","Answers cite sources"], glyph: "📚" }
```

### `stack`

A vertical list that grows across scenes, with one row highlighted.

**Use when:** You are building up a system piece by piece. Pass the FULL item list every scene and move `active`; use `revealed` to hide rows not yet introduced.

```
:: stack { items: ["MODEL","SYSTEM PROMPT","RAG","TOOLS"], revealed: 3, active: 2 }
```

### `pipeline`

Ordered steps in a belt, with the current one highlighted.

**Use when:** The narration walks through a sequence (split -> embed -> store -> retrieve). Keep the same `steps` across scenes and advance `active`.

```
:: pipeline { steps: ["SPLIT","EMBED","STORE","RETRIEVE"], active: 3, caption: "12,480 vectors" }
```

### `diagram`

Labelled nodes joined by arrows, placed automatically.

**Use when:** Showing how parts connect. Give nodes and edges only — never coordinates. Use `hub` when one node talks to all the others.

```
:: diagram { arrange: "hub", nodes: [{ id: "a", label: "AGENT", tone: "accent" }, { id: "db", label: "VECTOR DB" }, { id: "api", label: "ORDERS API" }], edges: [{ from: "a", to: "db" }, { from: "a", to: "api" }] }
```

### `compare`

Two opposed columns, side by side.

**Use when:** Before/after, us/them, naive/correct. Use tone to signal which side you favour.

```
:: compare { left: { title: "Fine-tune", items: ["Slow","Expensive"] }, right: { title: "RAG", items: ["Instant","Cited"], tone: "good" } }
```

### `device`

Content framed in browser, phone, terminal or inbox chrome.

**Use when:** Making something feel like a real product surface — an email, a dashboard, a CLI session.

```
:: device { kind: "inbox", title: "support@parcelco", body: ["From: sam@mail.com", "Late parcel :("] }
```

### `chat`

A phone conversation where messages land one at a time.

**Use when:** Showing a model's behaviour, a support exchange, or an attack. Mark hostile text with danger: true.

```
:: chat { messages: [{ from: "user", text: "Where is order #812?" }, { from: "bot", text: "Shipped Tuesday." }] }
```

### `code`

A terminal or editor pane revealing lines in turn.

**Use when:** Showing a prompt, a config, a log, or a command. Use `highlight` for the lines the narration is about.

```
:: code { title: "system prompt", lines: ["You are Nova.","Refund limit: $50."], highlight: [1] }
```

### `stat`

One to three large numbers that count up to their value.

**Use when:** The narration states a figure that deserves weight. Mark the figure with ** so the count lands on it.

```
:: stat { stats: [{ value: 48210, prefix: "$", label: "auto-refunded", tone: "accent" }] }
```

### `quote`

A pulled quote, optionally stamped.

**Use when:** Quoting a belief you are about to dismantle, or a line worth dwelling on.

```
:: quote { text: "Just fine-tune it on our docs.", stamp: "wrong" }
```

### `grid`

A grid of small labelled tiles.

**Use when:** Listing capabilities, tools, or options where order does not matter.

```
:: grid { columns: 3, items: [{ label: "search", glyph: "🔍" }, { label: "refund", glyph: "💸" }, { label: "email", glyph: "✉️" }] }
```

### `bubbles`

Scattered speech bubbles popping in one after another.

**Use when:** A chorus of voices — everyone asking the same thing, many objections at once.

```
:: bubbles { bubbles: [{ text: "we need AI!", x: 30, y: 30 }, { text: "our own AI!", x: 65, y: 50, tone: "accent" }] }
```

### `footage`

A video clip filling the frame, with optional overlaid text.

**Use when:** You need to show something real that a drawing cannot carry. Fetch the clip with `video fetch <url>` first; it is muted by default so the narration still leads.

```
:: footage { src: "footage/demo.mp4", headline: "This is what it looks like", badge: "live" }
```

### `custom`

Renders a project-supplied React component.

**Use when:** Nothing in the catalog fits. Write the component in projects/<name>/scenes/, register it, then reference it by name.

```
:: custom { component: "IsoCity", props: { buildings: 5 } }
```

## Rules

**Props are content, never style.** There is no `color`, no `fontSize`, no `x`
unless the layout is explicitly about placement. If you want a different look,
change the style pack, not the scene.

**Never pass coordinates to `diagram`.** Give nodes and edges; placement is
computed. Hand-placed boxes are how diagrams end up with arrows through labels.

**`stack` takes the full list every time.** Pass every item each scene and move
`active` / `revealed`. Passing only the visible items breaks the accretion
effect that makes the layout worth using.

**Reach for `custom` last.** Check the catalog twice first. A custom component
is unshared work that the next video cannot reuse.

**Vary consecutive layouts.** Two `stage` scenes back to back look like a
slideshow. The catalog is wide so the video has texture.

## When nothing fits

```bash
# 1. write projects/<name>/scenes/MyScene.tsx
# 2. register it:
#    registerComponent("MyScene", MyScene) in projects/<name>/scenes/index.ts
# 3. reference it:
#    :: custom { component: "MyScene", props: { ... } }
```

Custom components read tokens and timing from `useScene()` — never hard-code a
colour or a frame number. If a custom scene turns out to be generally useful,
promote it into `src/scenes/` and add it to the registry so every project gets it.

**Footage is not a free win.** A clip earns its place when it shows something a
drawing cannot — a real interface, a real place, a real reaction. Dropping in
stock b-roll because a scene feels empty makes the video look like an ad. Fetch
clips with `pnpm cadence fetch <project> <url>`; they arrive already scaled,
cropped and muted, because the narration owns the audio.
