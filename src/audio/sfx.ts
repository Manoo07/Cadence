/**
 * Sound design.
 *
 * Effects are derived from the spec rather than placed by hand: a transition
 * gets a whoosh, an emphasis beat gets a soft tick, a stamp gets an impact.
 * Deriving them means the sound stays in sync automatically when the script
 * changes, which hand-placed effects never do.
 *
 * Files are optional. If an effect is missing from assets/sfx/ it is skipped,
 * so a project works with no sound library at all.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { VideoSpec } from "../core/types.ts";

export type SfxCue = { path: string; atMs: number; gainDb?: number };

const CUES = {
  transition: { file: "whoosh.mp3", gainDb: -20 },
  beat: { file: "tick.mp3", gainDb: -26 },
  stamp: { file: "impact.mp3", gainDb: -14 },
  reveal: { file: "pop.mp3", gainDb: -24 },
} as const;

export const planSfx = (spec: VideoSpec, sfxDir: string): SfxCue[] => {
  const cues: SfxCue[] = [];
  const fps = spec.format.fps;
  const toMs = (frame: number) => (frame / fps) * 1000;

  const add = (kind: keyof typeof CUES, frame: number): void => {
    const cue = CUES[kind];
    const path = join(sfxDir, cue.file);
    if (!existsSync(path)) return;
    cues.push({ path, atMs: Math.max(0, toMs(frame)), gainDb: cue.gainDb });
  };

  spec.scenes.forEach((scene, i) => {
    if (i > 0 && scene.options.transition !== "cut") {
      add("transition", scene.startFrame);
    }
    if (scene.layout === "quote" && (scene.props as { stamp?: string }).stamp) {
      add("stamp", scene.startFrame + (scene.beats[0] ?? 18));
    }
    for (const beat of scene.beats) {
      add("beat", scene.startFrame + beat);
    }
  });

  return cues;
};
