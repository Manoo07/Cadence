/**
 * Transferring timings from a transcript onto a known script. Pure.
 *
 * ElevenLabs hands back timings indexed against the exact text we sent, so
 * scene spans line up for free. Whisper does not: it reports what it *heard*,
 * which drifts from the script — "fine-tune" becomes "fine tune", "RAG"
 * becomes "rag", a filler word appears, a quiet word vanishes.
 *
 * Naively zipping the two lists together therefore desynchronises everything
 * after the first mismatch. Instead the two word sequences are aligned with a
 * Needleman-Wunsch edit distance, timings are copied across matched pairs, and
 * script words with no counterpart are interpolated between their neighbours
 * in proportion to their length.
 *
 * The result is that the script stays the source of truth for *what* is on
 * screen while the audio decides *when* — which is what lets a human-recorded
 * voiceover, or audio pulled from an existing video, drive this pipeline
 * exactly as a synthesised one does.
 */

import type { CharSpan, Word } from "./types.ts";

export type TimedWord = {
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
};

/** Tokens as they appear in the script, with their position in it. */
export type ScriptToken = {
  readonly text: string;
  readonly span: CharSpan;
};

/** Split text into word tokens, recording where each one sits. */
export const tokenize = (text: string): ScriptToken[] => {
  const tokens: ScriptToken[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      span: { start: match.index, end: match.index + match[0].length },
    });
  }
  return tokens;
};

/**
 * Comparison form: lowercase, letters and digits only.
 *
 * This is what makes "Fine-tune," and "fine tune" comparable. Numbers are kept
 * as digits because Whisper is inconsistent about spelling them out, and a
 * digit run still matches itself.
 */
const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Op = "match" | "sub" | "del" | "ins";

/**
 * Needleman-Wunsch over the two token sequences.
 *
 * Returns, for each script token, the index of the transcript token it was
 * matched to, or null where the aligner found no counterpart.
 */
const alignSequences = (
  script: readonly string[],
  heard: readonly string[],
): (number | null)[] => {
  const n = script.length;
  const m = heard.length;

  // cost[i][j] = cheapest edit distance between script[0..i) and heard[0..j)
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const back: Op[][] = Array.from({ length: n + 1 }, () => new Array<Op>(m + 1).fill("match"));

  for (let i = 1; i <= n; i += 1) {
    cost[i]![0] = i;
    back[i]![0] = "del";
  }
  for (let j = 1; j <= m; j += 1) {
    cost[0]![j] = j;
    back[0]![j] = "ins";
  }

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const same = script[i - 1] === heard[j - 1];
      // A substitution costs slightly less than a delete plus an insert, so the
      // aligner prefers to pair a misheard word with its script counterpart
      // rather than dropping both and losing the timing anchor.
      const diagonal = cost[i - 1]![j - 1]! + (same ? 0 : 1);
      const deletion = cost[i - 1]![j]! + 1;
      const insertion = cost[i]![j - 1]! + 1;

      const best = Math.min(diagonal, deletion, insertion);
      cost[i]![j] = best;
      back[i]![j] = best === diagonal ? (same ? "match" : "sub") : best === deletion ? "del" : "ins";
    }
  }

  const pairs: (number | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const op = back[i]![j]!;
    if (op === "match" || op === "sub") {
      // Only a true match is trusted as a timing anchor. A substitution means
      // the aligner paired two different words to keep the sequence together;
      // its timing is a guess, so the word is interpolated instead.
      pairs[i - 1] = op === "match" ? j - 1 : null;
      i -= 1;
      j -= 1;
    } else if (op === "del") {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return pairs;
};

export type TransferOptions = {
  /** Fallback speaking rate for gaps with no anchor on one side. */
  readonly msPerChar?: number;
};

/**
 * Give every word of `scriptText` a start and end time, using `heard` as the
 * timing source.
 */
export const transferTimings = (
  scriptText: string,
  heard: readonly TimedWord[],
  options: TransferOptions = {},
): Word[] => {
  const { msPerChar = 62 } = options;
  const tokens = tokenize(scriptText);
  if (tokens.length === 0) return [];

  if (heard.length === 0) {
    // No audio to go on: lay the words out at a plausible reading speed so the
    // pipeline still produces something rather than collapsing to zero.
    let t = 0;
    return tokens.map((token) => {
      const duration = Math.max(90, token.text.length * msPerChar);
      const word = { text: token.text, startMs: t, endMs: t + duration, span: token.span };
      t += duration;
      return word;
    });
  }

  const pairs = alignSequences(
    tokens.map((t) => normalize(t.text)),
    heard.map((h) => normalize(h.text)),
  );

  const starts = new Array<number | null>(tokens.length).fill(null);
  const ends = new Array<number | null>(tokens.length).fill(null);

  pairs.forEach((heardIndex, i) => {
    if (heardIndex === null) return;
    const h = heard[heardIndex];
    if (!h) return;
    starts[i] = h.startMs;
    ends[i] = h.endMs;
  });

  // Anchor the ends so interpolation always has something to work between.
  const lastHeard = heard[heard.length - 1]!;
  if (starts[0] === null) starts[0] = heard[0]!.startMs;
  if (ends[tokens.length - 1] === null) ends[tokens.length - 1] = lastHeard.endMs;

  // Fill unanchored runs by sharing the gap out in proportion to word length,
  // which tracks how long a word actually takes to say far better than
  // splitting the gap evenly does.
  for (let i = 0; i < tokens.length; i += 1) {
    if (starts[i] !== null) continue;

    let runEnd = i;
    while (runEnd < tokens.length && starts[runEnd] === null) runEnd += 1;

    const beforeMs = i > 0 ? (ends[i - 1] ?? starts[i - 1]!) : 0;
    const afterMs =
      runEnd < tokens.length ? starts[runEnd]! : (ends[tokens.length - 1] ?? lastHeard.endMs);

    const run = tokens.slice(i, runEnd);
    const totalChars = run.reduce((sum, t) => sum + t.text.length, 0) || 1;
    const available = Math.max(0, afterMs - beforeMs);

    let cursor = beforeMs;
    for (let k = i; k < runEnd; k += 1) {
      const share = (tokens[k]!.text.length / totalChars) * available;
      starts[k] = cursor;
      cursor += share;
      ends[k] = cursor;
    }

    i = runEnd - 1;
  }

  // Enforce monotonicity: an aligner pairing can occasionally produce a word
  // that starts before its predecessor ends, and a caption that jumps backwards
  // is immediately visible.
  const words: Word[] = [];
  let previousEnd = 0;
  tokens.forEach((token, i) => {
    const start = Math.max(previousEnd, Math.round(starts[i] ?? previousEnd));
    const end = Math.max(start + 40, Math.round(ends[i] ?? start + 40));
    previousEnd = end;
    words.push({ text: token.text, startMs: start, endMs: end, span: token.span });
  });

  return words;
};

/** Fraction of script words that got a real timing anchor, 0–1. */
export const transferCoverage = (
  scriptText: string,
  heard: readonly TimedWord[],
): number => {
  const tokens = tokenize(scriptText);
  if (tokens.length === 0 || heard.length === 0) return 0;
  const pairs = alignSequences(
    tokens.map((t) => normalize(t.text)),
    heard.map((h) => normalize(h.text)),
  );
  return pairs.filter((p) => p !== null).length / tokens.length;
};
