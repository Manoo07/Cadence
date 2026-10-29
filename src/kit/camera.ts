/**
 * Camera moves.
 *
 * A still frame held for six seconds feels dead even when the content is good.
 * A continuous sub-perceptual move — a 3.5% push over the scene — keeps the
 * image alive without drawing attention to itself. The viewer should never
 * notice this; they should only notice its absence.
 */

import { interpolate } from "remotion";
import type { SceneOptions } from "../core/types.ts";
import type { Motion } from "./tokens.ts";

export type CameraMode = NonNullable<SceneOptions["camera"]>;

export const cameraTransform = (
  frame: number,
  durationInFrames: number,
  motion: Motion,
  mode: CameraMode = "push",
): string => {
  if (mode === "none") return "none";

  const t = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const a = motion.cameraAmount;

  switch (mode) {
    case "push":
      return `scale(${1 + t * a})`;
    case "pull":
      return `scale(${1 + a - t * a})`;
    case "drift": {
      // Slow lateral move plus a touch of scale, for wide illustrations.
      const x = Math.sin(t * Math.PI) * 14;
      return `scale(${1 + t * a * 0.6}) translateX(${x}px)`;
    }
    default:
      return "none";
  }
};

/** Parallax offset for a layer at `depth` (0 = background, 1 = foreground). */
export const parallax = (
  frame: number,
  durationInFrames: number,
  depth: number,
  amount = 18,
): number => {
  const t = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return t * amount * depth;
};
