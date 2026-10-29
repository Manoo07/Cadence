import { describe, expect, it } from "vitest";
import { tokenize, transferCoverage, transferTimings, type TimedWord } from "./transfer.ts";

/** Build a transcript at a steady pace, optionally mangled to mimic Whisper. */
const heardFrom = (text: string, msPerWord = 300): TimedWord[] =>
  text.split(/\s+/).filter(Boolean).map((w, i) => ({
    text: w,
    startMs: i * msPerWord,
    endMs: i * msPerWord + msPerWord - 40,
  }));

const SCRIPT = "Every company wants its own AI. Not a chatbot, something that knows their business.";

describe("tokenize", () => {
  it("records a span that indexes back into the source", () => {
    for (const t of tokenize(SCRIPT)) {
      expect(SCRIPT.slice(t.span.start, t.span.end)).toBe(t.text);
    }
  });

  it("handles leading, trailing and repeated whitespace", () => {
    expect(tokenize("  a   b  ").map((t) => t.text)).toEqual(["a", "b"]);
  });

  it("returns nothing for empty text", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("transferTimings", () => {
  it("copies timings straight across when the transcript is perfect", () => {
    const heard = heardFrom(SCRIPT);
    const words = transferTimings(SCRIPT, heard);
    expect(words).toHaveLength(heard.length);
    expect(words[0]!.startMs).toBe(0);
    expect(words[3]!.startMs).toBe(heard[3]!.startMs);
  });

  it("keeps spans pointing at the script, not the transcript", () => {
    const words = transferTimings(SCRIPT, heardFrom(SCRIPT));
    for (const w of words) {
      expect(SCRIPT.slice(w.span.start, w.span.end)).toBe(w.text);
    }
  });

  it("survives punctuation and casing differences", () => {
    const heard = heardFrom("every company wants its own ai not a chatbot something that knows their business");
    const words = transferTimings(SCRIPT, heard);
    expect(words).toHaveLength(14);
    expect(transferCoverage(SCRIPT, heard)).toBe(1);
  });

  it("does not drift after a misheard word", () => {
    // "chatbot" misheard as "chat bot": one word becomes two.
    const heard = heardFrom("Every company wants its own AI Not a chat bot something that knows their business");
    const words = transferTimings(SCRIPT, heard);
    const last = words[words.length - 1]!;
    // The final word must still land near the end of the audio, not drift early.
    expect(last.endMs).toBeGreaterThan(heard[heard.length - 1]!.startMs - 400);
    expect(words).toHaveLength(14);
  });

  it("interpolates words the transcript dropped", () => {
    const heard = heardFrom("Every company wants its own AI Not a chatbot that knows their business");
    const words = transferTimings(SCRIPT, heard);
    expect(words).toHaveLength(14);
    // "something" was dropped but must still get a sane, in-order window.
    const something = words.find((w) => w.text === "something")!;
    expect(something.startMs).toBeGreaterThan(0);
    expect(something.endMs).toBeGreaterThan(something.startMs);
  });

  it("ignores words the transcript invented", () => {
    const heard = heardFrom("Every um company wants its own AI Not a chatbot you know something that knows their business");
    const words = transferTimings(SCRIPT, heard);
    expect(words).toHaveLength(14);
    expect(words.map((w) => w.text).join(" ")).toBe(SCRIPT);
  });

  it("always produces monotonic, non-overlapping words", () => {
    const heard = heardFrom("Every company wants own AI Not chatbot something knows business");
    const words = transferTimings(SCRIPT, heard);
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i]!.startMs).toBeGreaterThanOrEqual(words[i - 1]!.endMs);
      expect(words[i]!.endMs).toBeGreaterThan(words[i]!.startMs);
    }
  });

  it("falls back to an estimated pace with no transcript at all", () => {
    const words = transferTimings(SCRIPT, []);
    expect(words).toHaveLength(14);
    expect(words[words.length - 1]!.endMs).toBeGreaterThan(1000);
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i]!.startMs).toBeGreaterThanOrEqual(words[i - 1]!.endMs);
    }
  });

  it("returns nothing for an empty script", () => {
    expect(transferTimings("", heardFrom("anything"))).toEqual([]);
  });

  it("handles a transcript that shares almost nothing with the script", () => {
    const words = transferTimings(SCRIPT, heardFrom("completely different words entirely"));
    expect(words).toHaveLength(14);
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i]!.startMs).toBeGreaterThanOrEqual(words[i - 1]!.endMs);
    }
  });
});

describe("transferCoverage", () => {
  it("is 1 for an exact transcript and lower for a poor one", () => {
    expect(transferCoverage(SCRIPT, heardFrom(SCRIPT))).toBe(1);
    const poor = transferCoverage(SCRIPT, heardFrom("every company and then some other words"));
    expect(poor).toBeLessThan(0.6);
    expect(poor).toBeGreaterThan(0);
  });

  it("is 0 with no transcript", () => {
    expect(transferCoverage(SCRIPT, [])).toBe(0);
  });
});
