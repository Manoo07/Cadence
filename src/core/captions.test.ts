import { describe, expect, it } from "vitest";
import { groupIntoPages, pageAt } from "./captions.ts";
import type { Word } from "./types.ts";

const words = (spec: [string, number, number][]): Word[] =>
  spec.map(([text, startMs, endMs]) => ({
    text,
    startMs,
    endMs,
    span: { start: 0, end: text.length },
  }));

describe("groupIntoPages", () => {
  it("returns nothing for no words", () => {
    expect(groupIntoPages([])).toEqual([]);
  });

  it("breaks on a long pause", () => {
    const pages = groupIntoPages(
      words([["one", 0, 200], ["two", 200, 400], ["three", 1500, 1700]]),
      { breakOnGapMs: 420 },
    );
    expect(pages).toHaveLength(2);
    expect(pages[0]!.text).toBe("one two");
    expect(pages[1]!.text).toBe("three");
  });

  it("breaks when a page grows too long", () => {
    const many = words(
      Array.from({ length: 12 }, (_, i) => [`word${i}`, i * 200, i * 200 + 180] as [string, number, number]),
    );
    const pages = groupIntoPages(many, { maxWords: 4, breakOnGapMs: 10_000 });
    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const p of pages) expect(p.words.length).toBeLessThanOrEqual(4);
  });

  it("breaks after a sentence ends", () => {
    const pages = groupIntoPages(
      words([["Hello", 0, 200], ["there.", 200, 400], ["Next", 420, 600], ["one", 600, 800]]),
      { breakOnGapMs: 10_000 },
    );
    expect(pages[0]!.text).toBe("Hello there.");
    expect(pages[1]!.text).toBe("Next one");
  });

  it("covers every word exactly once, in order", () => {
    const input = words(
      Array.from({ length: 40 }, (_, i) => [`w${i}`, i * 150, i * 150 + 120] as [string, number, number]),
    );
    const pages = groupIntoPages(input);
    const flat = pages.flatMap((p) => p.words.map((w) => w.text));
    expect(flat).toEqual(input.map((w) => w.text));
  });

  it("produces pages that never overlap in time", () => {
    const input = words(
      Array.from({ length: 30 }, (_, i) => [`w${i}`, i * 300, i * 300 + 250] as [string, number, number]),
    );
    const pages = groupIntoPages(input);
    for (let i = 1; i < pages.length; i += 1) {
      expect(pages[i]!.startMs).toBeGreaterThanOrEqual(pages[i - 1]!.endMs);
    }
  });

  it("keeps a page readable: never more than maxChars", () => {
    const input = words([
      ["extraordinarily", 0, 400],
      ["complicated", 400, 800],
      ["vocabulary", 800, 1200],
      ["here", 1200, 1400],
    ]);
    for (const p of groupIntoPages(input, { maxChars: 30, breakOnGapMs: 10_000 })) {
      expect(p.text.length).toBeLessThanOrEqual(34);
    }
  });
});

describe("pageAt", () => {
  const pages = groupIntoPages(
    words([["one", 0, 300], ["two", 300, 600], ["three", 2000, 2300]]),
  );

  it("finds nothing before the first page", () => {
    expect(pageAt(pages, -10)).toBeNull();
  });

  it("finds the page covering a moment", () => {
    expect(pageAt(pages, 100)!.text).toBe("one two");
    expect(pageAt(pages, 2100)!.text).toBe("three");
  });

  it("holds a page through a short gap after it", () => {
    expect(pageAt(pages, 700, 400)!.text).toBe("one two");
  });

  it("drops the page once it is well past", () => {
    expect(pageAt(pages, 2300 + 900, 400)).toBeNull();
  });
});
