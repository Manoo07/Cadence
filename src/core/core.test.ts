import { describe, expect, it } from "vitest";
import { mockAlignment, sceneTimings, toWords, wordsInSpan } from "./align.ts";
import { compile, toSrt } from "./compile.ts";
import { extractEmphasis, parseScript } from "./script.ts";
import type { CharAlignment } from "./types.ts";

const SCRIPT = `---
title: Test Video
voice: elevenlabs:Rachel
style: paper-vector
format: 9x16
---

## 01 - intro
:: title { text: "Hello" }
Every company wants its **own AI**.

## 02 - body
:: pipeline { steps: ["SPLIT", "EMBED"], active: 1 }
> transition: slide
So before **every** answer it looks things up.
`;

/** Build a character alignment at a fixed rate, so assertions are exact. */
const evenAlignment = (text: string, msPerChar = 50): CharAlignment => ({
  characters: [...text],
  startTimesSeconds: [...text].map((_, i) => (i * msPerChar) / 1000),
  endTimesSeconds: [...text].map((_, i) => ((i + 1) * msPerChar) / 1000),
});

describe("parseScript", () => {
  it("parses frontmatter, scenes, layouts and props", () => {
    const r = parseScript(SCRIPT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.meta.title).toBe("Test Video");
    expect(r.value.meta.format).toBe("9x16");
    expect(r.value.scenes).toHaveLength(2);

    const [first, second] = r.value.scenes;
    expect(first!.layout).toBe("title");
    expect(first!.props).toEqual({ text: "Hello" });
    expect(second!.layout).toBe("pipeline");
    expect(second!.props).toEqual({ steps: ["SPLIT", "EMBED"], active: 1 });
    expect(second!.options.transition).toBe("slide");
  });

  it("strips emphasis markers from the spoken text", () => {
    const r = parseScript(SCRIPT);
    if (!r.ok) throw new Error("parse failed");
    expect(r.value.voiceoverText).not.toContain("*");
    expect(r.value.scenes[0]!.narration).toBe("Every company wants its own AI.");
  });

  it("records scene spans that index into the voiceover text", () => {
    const r = parseScript(SCRIPT);
    if (!r.ok) throw new Error("parse failed");
    const { voiceoverText, scenes } = r.value;
    for (const scene of scenes) {
      expect(voiceoverText.slice(scene.span.start, scene.span.end)).toBe(scene.narration);
    }
  });

  it("records emphasis spans that point at the emphasised words", () => {
    const r = parseScript(SCRIPT);
    if (!r.ok) throw new Error("parse failed");
    const { voiceoverText, scenes } = r.value;
    const e0 = scenes[0]!.emphasis[0]!;
    expect(voiceoverText.slice(e0.start, e0.end)).toBe("own AI");
    const e1 = scenes[1]!.emphasis[0]!;
    expect(voiceoverText.slice(e1.start, e1.end)).toBe("every");
  });

  it("rejects a script with no frontmatter", () => {
    expect(parseScript("## 01 - x\nhello").ok).toBe(false);
  });

  it("reports unparseable props as a structured issue", () => {
    const bad = SCRIPT.replace('{ text: "Hello" }', "{ text: 'Hello' }");
    const r = parseScript(bad);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error[0]!.code).toBe("props.invalid-json");
    expect(r.error[0]!.hint).toBeTruthy();
  });

  it("gives duplicate headings distinct ids", () => {
    const dup = `---\ntitle: t\n---\n\n## same\n:: title\nOne.\n\n## same\n:: title\nTwo.\n`;
    const r = parseScript(dup);
    if (!r.ok) throw new Error("parse failed");
    const ids = r.value.scenes.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("extractEmphasis", () => {
  it("returns clean text plus spans over that clean text", () => {
    const { text, emphasis } = extractEmphasis("a **bold** c **two**");
    expect(text).toBe("a bold c two");
    expect(emphasis.map((e) => text.slice(e.start, e.end))).toEqual(["bold", "two"]);
  });

  it("leaves an unclosed marker alone", () => {
    expect(extractEmphasis("a **b").text).toBe("a **b");
  });
});

describe("toWords", () => {
  it("folds characters into words with correct boundaries", () => {
    const words = toWords(evenAlignment("ab cd"));
    expect(words.map((w) => w.text)).toEqual(["ab", "cd"]);
    expect(words[0]!.startMs).toBe(0);
    expect(words[0]!.endMs).toBe(100);
    expect(words[1]!.startMs).toBe(150);
  });

  it("keeps punctuation attached to its word", () => {
    expect(toWords(evenAlignment("Hi, there.")).map((w) => w.text)).toEqual([
      "Hi,",
      "there.",
    ]);
  });

  it("gives every word a span that indexes the source text", () => {
    const text = "one two three";
    for (const w of toWords(evenAlignment(text))) {
      expect(text.slice(w.span.start, w.span.end)).toBe(w.text);
    }
  });

  it("handles empty input", () => {
    expect(toWords({ characters: [], startTimesSeconds: [], endTimesSeconds: [] })).toEqual([]);
  });
});

describe("wordsInSpan", () => {
  it("selects only words overlapping the span", () => {
    const text = "alpha beta gamma";
    const words = toWords(evenAlignment(text));
    const picked = wordsInSpan(words, { start: 6, end: 10 });
    expect(picked.map((w) => w.text)).toEqual(["beta"]);
  });
});

describe("sceneTimings", () => {
  const build = () => {
    const parsed = parseScript(SCRIPT);
    if (!parsed.ok) throw new Error("parse failed");
    const alignment = evenAlignment(parsed.value.voiceoverText);
    const words = toWords(alignment);
    return {
      script: parsed.value,
      words,
      timings: sceneTimings(parsed.value.scenes, words, { fps: 30 }),
    };
  };

  it("starts the first scene at frame 0", () => {
    expect(build().timings[0]!.startFrame).toBe(0);
  });

  it("produces contiguous scenes with no gaps or overlaps", () => {
    const { timings } = build();
    for (let i = 0; i < timings.length - 1; i += 1) {
      const end = timings[i]!.startFrame + timings[i]!.durationInFrames;
      expect(end).toBe(timings[i + 1]!.startFrame);
    }
  });

  it("derives duration from the audio rather than from the author", () => {
    const { timings } = build();
    for (const t of timings) expect(t.durationInFrames).toBeGreaterThan(0);
    // Scene 2's narration is longer, so it must occupy more frames.
    expect(timings[1]!.durationInFrames).toBeGreaterThan(20);
  });

  it("emits an emphasis beat per scene, relative to that scene's start", () => {
    const { timings } = build();
    for (const t of timings) {
      expect(t.beats).toHaveLength(1);
      expect(t.beats[0]).toBeGreaterThanOrEqual(0);
      expect(t.beats[0]).toBeLessThan(t.durationInFrames);
    }
  });

  it("re-times every scene when narration changes, with no manual edits", () => {
    const { timings: before } = build();
    const longer = SCRIPT.replace(
      "So before **every** answer it looks things up.",
      "So before **every** answer it looks things up in a much longer sentence indeed.",
    );
    const parsed = parseScript(longer);
    if (!parsed.ok) throw new Error("parse failed");
    const words = toWords(evenAlignment(parsed.value.voiceoverText));
    const after = sceneTimings(parsed.value.scenes, words, { fps: 30 });
    expect(after[1]!.durationInFrames).toBeGreaterThan(before[1]!.durationInFrames);
  });

  it("honours a hold by extending the scene", () => {
    const held = SCRIPT.replace("> transition: slide", "> transition: slide\n> hold: 2000");
    const parsed = parseScript(held);
    if (!parsed.ok) throw new Error("parse failed");
    const words = toWords(evenAlignment(parsed.value.voiceoverText));
    const timings = sceneTimings(parsed.value.scenes, words, { fps: 30 });
    const plain = build().timings;
    expect(timings[1]!.durationInFrames).toBeGreaterThan(plain[1]!.durationInFrames);
  });

  it("gives a silent scene a minimum readable duration", () => {
    const silent = `---\ntitle: t\n---\n\n## 01 - a\n:: title\nSpoken line here.\n\n## 02 - quiet\n:: stage\n`;
    const parsed = parseScript(silent);
    if (!parsed.ok) throw new Error("parse failed");
    const words = toWords(evenAlignment(parsed.value.voiceoverText));
    const timings = sceneTimings(parsed.value.scenes, words, { fps: 30, minSceneMs: 900 });
    expect(timings[1]!.durationInFrames).toBeGreaterThanOrEqual(27);
  });
});

describe("compile", () => {
  it("produces a fully resolved spec", () => {
    const parsed = parseScript(SCRIPT);
    if (!parsed.ok) throw new Error("parse failed");
    const alignment = mockAlignment(parsed.value.voiceoverText);
    const r = compile(parsed.value, toWords(alignment), { voiceoverPath: "vo.mp3" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const spec = r.value;
    expect(spec.format.width).toBe(1080);
    expect(spec.format.height).toBe(1920);
    expect(spec.scenes).toHaveLength(2);
    expect(spec.captions.length).toBeGreaterThan(5);

    const last = spec.scenes[spec.scenes.length - 1]!;
    expect(spec.durationInFrames).toBe(last.startFrame + last.durationInFrames);
  });

  it("round-trips through JSON, since video.json is the hand-off", () => {
    const parsed = parseScript(SCRIPT);
    if (!parsed.ok) throw new Error("parse failed");
    const r = compile(parsed.value, toWords(mockAlignment(parsed.value.voiceoverText)), {
      voiceoverPath: "vo.mp3",
    });
    if (!r.ok) throw new Error("compile failed");
    expect(JSON.parse(JSON.stringify(r.value))).toEqual(r.value);
  });
});

describe("mockAlignment", () => {
  it("produces parallel arrays of the right length", () => {
    const a = mockAlignment("hello world");
    expect(a.characters).toHaveLength(11);
    expect(a.startTimesSeconds).toHaveLength(11);
    expect(a.endTimesSeconds).toHaveLength(11);
  });

  it("increases monotonically", () => {
    const a = mockAlignment("one two. three");
    for (let i = 1; i < a.startTimesSeconds.length; i += 1) {
      expect(a.startTimesSeconds[i]!).toBeGreaterThanOrEqual(a.startTimesSeconds[i - 1]!);
    }
  });

  it("lands in a believable speaking range", () => {
    const words = 150;
    const text = Array.from({ length: words }, () => "word").join(" ");
    const a = mockAlignment(text, { wordsPerMinute: 150 });
    const seconds = a.endTimesSeconds[a.endTimesSeconds.length - 1]!;
    expect(seconds).toBeGreaterThan(45);
    expect(seconds).toBeLessThan(80);
  });
});

describe("toSrt", () => {
  it("emits well-formed cues", () => {
    const words = toWords(evenAlignment("one two three four five six seven eight"));
    const srt = toSrt(words, 20);
    expect(srt).toMatch(/^1\n00:00:00,000 --> /);
    expect(srt.split("\n\n").length).toBeGreaterThan(1);
  });
});
