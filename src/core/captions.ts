/**
 * Caption paging. Pure.
 *
 * Words have to be grouped into the chunks that appear on screen together.
 * This lives in core, and not in the Remotion caption component, because both
 * render backends must page identically — a caption that reads differently
 * depending on which renderer produced the file is a caption you cannot trust.
 *
 * Two rules decide a page break, and between them they track how someone
 * actually speaks:
 *
 *   - a pause longer than `breakOnGapMs` (a breath, a full stop)
 *   - a page that has grown past `maxChars` or `maxWords`
 *
 * Grouping by time alone produces pages that are occasionally far too long;
 * grouping by count alone breaks sentences mid-clause. Both together give
 * pages that land on natural phrases.
 */

import type { Word } from "./types.ts";

export type CaptionPage = {
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly words: readonly Word[];
};

export type PagingOptions = {
  /** A silence at least this long starts a new page. */
  readonly breakOnGapMs?: number;
  readonly maxChars?: number;
  readonly maxWords?: number;
};

export const groupIntoPages = (
  words: readonly Word[],
  options: PagingOptions = {},
): CaptionPage[] => {
  const { breakOnGapMs = 420, maxChars = 42, maxWords = 7 } = options;
  if (words.length === 0) return [];

  const pages: CaptionPage[] = [];
  let current: Word[] = [];
  let chars = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    pages.push({
      text: current.map((w) => w.text).join(" "),
      startMs: current[0]!.startMs,
      endMs: current[current.length - 1]!.endMs,
      words: current,
    });
    current = [];
    chars = 0;
  };

  for (const [i, word] of words.entries()) {
    const previous = words[i - 1];
    const gap = previous ? word.startMs - previous.endMs : 0;

    const wouldOverflow =
      current.length >= maxWords || chars + word.text.length + 1 > maxChars;

    if (current.length > 0 && (gap >= breakOnGapMs || wouldOverflow)) flush();

    current.push(word);
    chars += word.text.length + 1;

    // A sentence ending is the most natural break there is, so take it rather
    // than carrying the first words of the next sentence onto this page.
    if (/[.!?]$/.test(word.text) && current.length >= 2) flush();
  }

  flush();
  return pages;
};

/** The page visible at `ms`, or null. Pages persist until the next one starts. */
export const pageAt = (
  pages: readonly CaptionPage[],
  ms: number,
  lingerMs = 400,
): CaptionPage | null => {
  let found: CaptionPage | null = null;
  for (const page of pages) {
    if (page.startMs <= ms) found = page;
    else break;
  }
  if (!found) return null;
  // Drop the last page once it is well past, so the video does not end on
  // stale text sitting under silence.
  return ms <= found.endMs + lingerMs ? found : null;
};
