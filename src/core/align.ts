/**
 * Alignment — turning character timings into scene timings. Pure.
 *
 * TTS engines hand back a timing per *character* of the text we sent. Since the
 * parser recorded which character range each scene owns, three useful things
 * fall out of that one array without any extra work:
 *
 *   toWords()         fold characters into words        -> caption timing
 *   sceneTimings()    bucket words by scene span        -> scene cuts
 *   beatsForScene()   locate emphasised words           -> visual accents
 *
 * The consequence worth stating: a scene's duration is never authored. It is
 * measured from the voiceover. Edit a line of narration and every downstream
 * frame number moves to match, automatically.
 */

import type { CharAlignment, CharSpan, SceneTiming, ScriptScene, Word } from "./types.ts";

const isWordBoundary = (ch: string): boolean => /\s/.test(ch);

/**
 * Fold per-character timings into per-word timings.
 *
 * A word starts at its first character's start time and ends at its last
 * character's end time. Punctuation stays attached to the word it follows, so
 * captions read naturally.
 */
export const toWords = (alignment: CharAlignment): Word[] => {
  const { characters, startTimesSeconds, endTimesSeconds } = alignment;
  const words: Word[] = [];

  let buffer = "";
  let bufferStartIndex = -1;
  let startMs = 0;
  let endMs = 0;

  const flush = () => {
    if (buffer === "" || bufferStartIndex === -1) return;
    words.push({
      text: buffer,
      startMs,
      endMs: Math.max(endMs, startMs + 1),
      span: { start: bufferStartIndex, end: bufferStartIndex + buffer.length },
    });
    buffer = "";
    bufferStartIndex = -1;
  };

  for (let i = 0; i < characters.length; i += 1) {
    const ch = characters[i] ?? "";
    if (isWordBoundary(ch)) {
      flush();
      continue;
    }
    if (buffer === "") {
      bufferStartIndex = i;
      startMs = Math.round((startTimesSeconds[i] ?? 0) * 1000);
    }
    buffer += ch;
    endMs = Math.round((endTimesSeconds[i] ?? 0) * 1000);
  }
  flush();

  return words;
};

const overlaps = (a: CharSpan, b: CharSpan): boolean =>
  a.start < b.end && b.start < a.end;

/** Every word whose characters fall inside `span`. */
export const wordsInSpan = (words: readonly Word[], span: CharSpan): Word[] =>
  words.filter((w) => overlaps(w.span, span));

const msToFrames = (ms: number, fps: number): number =>
  Math.round((ms / 1000) * fps);

export type SceneTimingOptions = {
  readonly fps: number;
  /** Silence appended to the last scene so the video does not end on a hard cut. */
  readonly tailMs?: number;
  /** Floor applied to any scene, so a one-word scene is still readable. */
  readonly minSceneMs?: number;
};

/**
 * Lay the scenes out on the timeline.
 *
 * Scenes are contiguous: each one runs until the next one's first word is
 * spoken, so there is never a gap or an overlap, and a cut always lands on a
 * sentence boundary rather than mid-word. A scene's own `holdMs` pushes the
 * following scene later rather than stealing time from it.
 */
export const sceneTimings = (
  scenes: readonly ScriptScene[],
  words: readonly Word[],
  options: SceneTimingOptions,
): SceneTiming[] => {
  const { fps, tailMs = 600, minSceneMs = 900 } = options;

  // Resolve each scene to the audio window its narration occupies.
  const windows = scenes.map((scene) => {
    const inScene = wordsInSpan(words, scene.span);
    const first = inScene[0];
    const last = inScene[inScene.length - 1];
    return {
      scene,
      startMs: first?.startMs ?? null,
      endMs: last?.endMs ?? null,
      words: inScene,
    };
  });

  // A silent scene (no narration) has no audio window; give it its hold time
  // and let it sit between its neighbours.
  let cursorMs = 0;
  const resolved = windows.map((w) => {
    const hold = w.scene.options.holdMs ?? 0;
    const startMs = w.startMs ?? cursorMs;
    const endMs = (w.endMs ?? startMs + Math.max(hold, minSceneMs)) + hold;
    cursorMs = Math.max(cursorMs, endMs);
    return { ...w, startMs, endMs };
  });

  return resolved.map((current, index) => {
    const next = resolved[index + 1];
    const isLast = index === resolved.length - 1;

    const startMs = index === 0 ? 0 : current.startMs;
    // Run up to the next scene's first spoken word; the last scene gets a tail.
    const rawEndMs = isLast ? current.endMs + tailMs : Math.max(next!.startMs, current.endMs);
    const endMs = Math.max(rawEndMs, startMs + minSceneMs);

    const startFrame = msToFrames(startMs, fps);
    const durationInFrames = Math.max(1, msToFrames(endMs, fps) - startFrame);

    return {
      id: current.scene.id,
      startFrame,
      durationInFrames,
      beats: beatsForScene(current.scene, words, fps, startMs),
    };
  });
};

/**
 * Frames, relative to the scene's start, at which emphasised words are spoken.
 *
 * Scenes use these to time an accent — a stamp landing, a counter ticking, a
 * highlight snapping on — to the syllable rather than to an arbitrary offset.
 * That synchronisation is most of what makes a scene feel deliberate.
 */
export const beatsForScene = (
  scene: ScriptScene,
  words: readonly Word[],
  fps: number,
  sceneStartMs: number,
): number[] =>
  scene.emphasis
    .map((span) => {
      const hit = wordsInSpan(words, span)[0];
      if (!hit) return null;
      return Math.max(0, msToFrames(hit.startMs - sceneStartMs, fps));
    })
    .filter((f): f is number => f !== null)
    .sort((a, b) => a - b);

/** Total video length, including the tail silence. */
export const totalDuration = (timings: readonly SceneTiming[]): number => {
  if (timings.length === 0) return 1;
  const last = timings[timings.length - 1]!;
  return last.startFrame + last.durationInFrames;
};

/**
 * Build a plausible alignment without calling a TTS engine.
 *
 * Used by `--mock-voice` so the whole pipeline — layout, captions, transitions,
 * render — can be exercised offline. Timing is estimated from word length with
 * a pause after sentence punctuation; close enough to judge pacing, not close
 * enough to ship.
 */
export const mockAlignment = (
  text: string,
  opts: { wordsPerMinute?: number } = {},
): CharAlignment => {
  const { wordsPerMinute = 155 } = opts;
  const msPerChar = 60000 / wordsPerMinute / 5.1; // ~5.1 chars per word average
  const characters: string[] = [];
  const startTimesSeconds: number[] = [];
  const endTimesSeconds: number[] = [];

  let t = 0;
  for (const ch of text) {
    const duration = /\s/.test(ch) ? msPerChar * 0.6 : msPerChar;
    characters.push(ch);
    startTimesSeconds.push(t / 1000);
    t += duration;
    endTimesSeconds.push(t / 1000);
    if (/[.!?]/.test(ch)) t += 260;
    else if (/[,;:—]/.test(ch)) t += 120;
  }

  return { characters, startTimesSeconds, endTimesSeconds };
};
