/**
 * The starter script written by `video new`.
 *
 * It doubles as the format's documentation: anyone (or any model) opening a
 * fresh project sees a working example of every piece of syntax.
 */

export const SCRIPT_TEMPLATE = (name: string): string => `---
title: ${name}
voice: elevenlabs:Rachel
style: paper-vector
format: 9x16
captions: selection
---

<!--
  Scene syntax
    ## <label>            the scene; label shows top-left as "// <label>"
    :: layout { props }   what is on screen  (pnpm video catalog lists them all)
    > transition: slide   options: transition, transitionMs, hold, camera
    plain text            the narration — this is what gets spoken
    **like this**         an emphasis beat; visuals land on the spoken word

  Scene durations are measured from the voiceover. Never set them by hand.
-->

## 01 — the hook
:: title { text: "Every company wants its own AI", eyebrow: "01 · the problem" }
Every company wants its **own AI**. Not a chatbot — something that actually knows their business.

## 02 — the naive answer
:: quote { text: "Just fine-tune it on our docs.", stamp: "wrong" }
So the first instinct is always the same: **fine-tune it** on our documents.

## 03 — why that fails
:: compare { left: { title: "Fine-tune", items: ["Days to train", "Stale the moment it ships", "No sources"] }, right: { title: "Retrieval", items: ["Instant updates", "Always current", "Cites its answer"], tone: "good" } }
> transition: slide
But training bakes the knowledge in. Change one policy and you start **over**.

## 04 — the pipeline
:: pipeline { steps: ["SPLIT", "EMBED", "STORE", "RETRIEVE"], active: 3, caption: "12,480 vectors" }
> transition: wipe
Retrieval works differently. Split the documents, embed them, store them — then look them up before **every** answer.

## 05 — the payoff
:: stat { stats: [{ value: 94, suffix: "%", label: "answers cited", tone: "good" }] }
> transition: fade
Which is why a retrieval system answers with **receipts**, and a fine-tuned one just sounds confident.
`;
