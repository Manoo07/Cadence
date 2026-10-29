/**
 * compile — Script + alignment -> VideoSpec. Pure.
 *
 * This is the last pure step. Everything after it is React and ffmpeg. The
 * output is `video.json`: fully resolved frame numbers, no derivation left to
 * do at render time, and readable enough that a human (or Claude) can hand-edit
 * one scene without re-running the pipeline.
 */

import { sceneTimings, totalDuration } from "./align.ts";
import { ok, type Issue, type Result } from "./result.ts";
import { FORMATS, type Script, type SpecScene, type VideoSpec, type Word } from "./types.ts";

export type CompileOptions = {
  readonly voiceoverPath: string;
  readonly tailMs?: number;
  readonly minSceneMs?: number;
};

/**
 * Compile a script plus its word timings into a finished spec.
 *
 * Timings arrive as `Word[]` whatever produced them — ElevenLabs character
 * alignment folded into words, or a Whisper transcript transferred onto the
 * script. Both carry spans that index the voiceover text, so everything
 * downstream is identical regardless of where the audio came from.
 */
export const compile = (
  script: Script,
  words: readonly Word[],
  options: CompileOptions,
): Result<VideoSpec, Issue[]> => {
  const format = FORMATS[script.meta.format];

  const timings = sceneTimings(script.scenes, words, {
    fps: format.fps,
    tailMs: options.tailMs ?? 600,
    minSceneMs: options.minSceneMs ?? 900,
  });

  const byId = new Map(timings.map((t) => [t.id, t]));

  const scenes: SpecScene[] = script.scenes.map((scene) => {
    const timing = byId.get(scene.id)!;
    return {
      id: scene.id,
      label: scene.label,
      layout: scene.layout,
      props: scene.props,
      startFrame: timing.startFrame,
      durationInFrames: timing.durationInFrames,
      beats: timing.beats,
      options: scene.options,
    };
  });

  const spec: VideoSpec = {
    version: 1,
    meta: script.meta,
    format,
    durationInFrames: totalDuration(timings),
    audio: {
      voiceover: options.voiceoverPath,
      music: script.meta.music,
      musicGainDb: script.meta.musicGainDb ?? -22,
    },
    scenes,
    captions: [...words],
  };

  return ok(spec);
};

/** Captions as SRT, for platforms that want a sidecar file. */
export const toSrt = (words: readonly Word[], maxCharsPerCue = 42): string => {
  const cues: { text: string; startMs: number; endMs: number }[] = [];
  let current: { text: string; startMs: number; endMs: number } | null = null;

  for (const w of words) {
    if (current && current.text.length + w.text.length + 1 <= maxCharsPerCue) {
      current.text += ` ${w.text}`;
      current.endMs = w.endMs;
    } else {
      if (current) cues.push(current);
      current = { text: w.text, startMs: w.startMs, endMs: w.endMs };
    }
  }
  if (current) cues.push(current);

  const stamp = (ms: number): string => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const milli = Math.floor(ms % 1000);
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
  };

  return cues
    .map((c, i) => `${i + 1}\n${stamp(c.startMs)} --> ${stamp(c.endMs)}\n${c.text}\n`)
    .join("\n");
};
