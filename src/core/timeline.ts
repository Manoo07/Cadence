/**
 * Transition compensation. Pure.
 *
 * A TransitionSeries transition is an *overlap*, not a gap: a 12-frame
 * transition makes the timeline 12 frames shorter. Left alone, every cut would
 * pull the picture earlier against a voiceover that does not move, and the
 * error would accumulate — by the twentieth scene the video would be seconds
 * out of sync.
 *
 * Padding each scene by half of each adjacent transition cancels the overlaps
 * exactly:
 *
 *     d(i) = compiled(i) + floor(tIn(i)/2) + ceil(tIn(i+1)/2)
 *
 * Summing: the two halves contributed by each transition add back the frames
 * its overlap removes, so the total equals the sum of the compiled durations
 * and every transition straddles the cut it belongs to.
 *
 * The halves are floored on one side and ceiled on the other rather than
 * rounded independently. An odd transition length has no integer half, and
 * rounding both sides up silently adds a frame per cut — which is the very
 * drift this function exists to prevent.
 *
 * This lives in core rather than in the composition because it is arithmetic
 * that must be provably right, and arithmetic in a React component cannot be
 * tested without a renderer.
 */

export type TimelinePlan = {
  /** Durations to hand to each TransitionSeries.Sequence. */
  readonly durations: readonly number[];
  /** Total frames the series will occupy once overlaps are applied. */
  readonly totalInFrames: number;
};

export const planTimeline = (
  compiledDurations: readonly number[],
  /** Incoming transition length per scene; index 0 is ignored (no transition). */
  transitionFrames: readonly number[],
): TimelinePlan => {
  const durations = compiledDurations.map((compiled, i) => {
    const tIn = i === 0 ? 0 : (transitionFrames[i] ?? 0);
    const tOut = i === compiledDurations.length - 1 ? 0 : (transitionFrames[i + 1] ?? 0);
    return Math.max(1, compiled + Math.floor(tIn / 2) + Math.ceil(tOut / 2));
  });

  const overlap = transitionFrames
    .slice(1, compiledDurations.length)
    .reduce((sum, t) => sum + (t ?? 0), 0);

  const totalInFrames = durations.reduce((a, b) => a + b, 0) - overlap;

  return { durations, totalInFrames };
};
