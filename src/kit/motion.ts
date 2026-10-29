/**
 * Motion primitives.
 *
 * Linear interpolation is the single biggest reason motion graphics look
 * cheap. Every move in this project goes through a spring or an eased curve,
 * and every group of siblings staggers. These helpers make the right thing the
 * easy thing, so a scene author never writes a raw interpolate() for entrance.
 */

import { Easing, interpolate, spring } from "remotion";
import type { Motion } from "./tokens.ts";

export type SpringName = "enter" | "pop" | "heavy";

export type EnterOptions = {
  /** Frames to wait before this element moves. */
  delay?: number;
  spring?: SpringName;
};

/**
 * Entrance progress, 0 -> 1.
 *
 * Returns a raw number so the caller decides what it drives — opacity, a slide,
 * a scale, a path length. Keeping the curve and the property separate is what
 * lets many elements share one rhythm.
 */
export const useEnterValue = (
  frame: number,
  fps: number,
  motion: Motion,
  options: EnterOptions = {},
): number => {
  const { delay = 0, spring: name = "enter" } = options;
  return spring({
    frame: frame - delay,
    fps,
    config: motion.spring[name],
    durationInFrames: undefined,
  });
};

/** Exit progress, 0 -> 1, over the last `frames` of a scene. */
export const useExitValue = (
  frame: number,
  durationInFrames: number,
  frames = 10,
): number =>
  interpolate(frame, [durationInFrames - frames, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/**
 * The standard entrance: fade up with a short rise.
 *
 * Returning a style object rather than numbers keeps scene code declarative —
 * `<div style={enter(...)}>` reads as intent, not as arithmetic.
 */
export const enter = (
  frame: number,
  fps: number,
  motion: Motion,
  options: EnterOptions & { distance?: number } = {},
): React.CSSProperties => {
  const { distance = 28 } = options;
  const p = useEnterValue(frame, fps, motion, options);
  return {
    opacity: Math.min(1, p * 1.4),
    transform: `translateY(${(1 - p) * distance}px)`,
  };
};

/** Entrance that scales up from slightly small — for badges, stamps, counters. */
export const popIn = (
  frame: number,
  fps: number,
  motion: Motion,
  options: EnterOptions = {},
): React.CSSProperties => {
  const p = useEnterValue(frame, fps, motion, { spring: "pop", ...options });
  return { opacity: Math.min(1, p * 2), transform: `scale(${0.82 + p * 0.18})` };
};

/**
 * Delay for the nth sibling in a staggered group.
 *
 * Stagger is doing a lot of work: it turns "five things appeared" into "a list
 * built itself", which reads as explanation rather than decoration.
 */
export const stagger = (index: number, motion: Motion, base = 0): number =>
  base + index * motion.stagger;

/**
 * A beat accent: a brief swell when an emphasised word is spoken.
 *
 * `beats` comes from the alignment, so this lands on the syllable. Used for the
 * small scale kick that makes a visual feel connected to the narration.
 */
export const beatPulse = (
  frame: number,
  beats: readonly number[],
  options: { amount?: number; frames?: number } = {},
): number => {
  const { amount = 0.045, frames = 9 } = options;
  let best = 0;
  for (const beat of beats) {
    const since = frame - beat;
    if (since < 0 || since > frames) continue;
    const t = since / frames;
    // One half-sine: rises and settles, never overshoots on the way out.
    best = Math.max(best, Math.sin(t * Math.PI) * amount);
  }
  return 1 + best;
};

/** True while a beat is within `window` frames — for discrete reactions. */
export const onBeat = (frame: number, beats: readonly number[], window = 6): boolean =>
  beats.some((b) => frame >= b && frame < b + window);

/** Eased 0->1 over an explicit frame range. The escape hatch from springs. */
export const ramp = (
  frame: number,
  from: number,
  to: number,
  easing = Easing.bezier(0.22, 1, 0.36, 1),
): number =>
  interpolate(frame, [from, to], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** Continuous gentle drift, for idle elements that would otherwise look dead. */
export const idleDrift = (frame: number, seed = 0, amount = 4, period = 150): number =>
  Math.sin((frame / period) * Math.PI * 2 + seed) * amount;

/** Draw-on progress for an SVG path, via stroke-dash. */
export const drawPath = (
  progress: number,
  length: number,
): { strokeDasharray: number; strokeDashoffset: number } => ({
  strokeDasharray: length,
  strokeDashoffset: length * (1 - progress),
});

/**
 * Count from 0 to `value`, easing out so the number settles rather than stops.
 * Rounded, because a counter showing 47.3194 reads as a bug.
 */
export const countUp = (
  frame: number,
  value: number,
  options: { from?: number; to?: number; decimals?: number } = {},
): number => {
  const { from = 0, to = 24, decimals = 0 } = options;
  const p = ramp(frame, from, to);
  const n = value * p;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
};
