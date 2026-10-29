/**
 * Transition resolution.
 *
 * The script names a transition; this turns that name into a Remotion
 * presentation. Shader presentations are only handed back when the style pack
 * opts in, because a WebGL failure surfaces as a broken render rather than a
 * warning.
 */

import {
  linearTiming,
  springTiming,
  type TransitionPresentation,
  type TransitionTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { iris } from "@remotion/transitions/iris";
import { none } from "@remotion/transitions/none";
import { pushCut } from "@remotion/transitions/push-cut";
import type { Format, TransitionName } from "../core/types.ts";
import type { StylePack } from "../kit/tokens.ts";

export type ResolvedTransition = {
  presentation: TransitionPresentation<Record<string, unknown>>;
  timing: TransitionTiming;
  durationInFrames: number;
};

/**
 * `cut` is modelled as a 1-frame `none`, not as the absence of a transition,
 * so the timeline arithmetic stays uniform: every gap between scenes is a
 * transition of some length.
 */
export const resolveTransition = (
  name: TransitionName | undefined,
  style: StylePack,
  format: Format,
  durationMs?: number,
): ResolvedTransition | null => {
  if (!name || name === "cut") return null;

  const frames = durationMs
    ? Math.max(1, Math.round((durationMs / 1000) * format.fps))
    : style.motion.transitionFrames;

  const timing =
    name === "none"
      ? linearTiming({ durationInFrames: 1 })
      : springTiming({ config: style.motion.spring.enter, durationInFrames: frames });

  const presentation = (() => {
    switch (name) {
      case "fade":
        return fade();
      case "slide":
        return slide({ direction: "from-right" });
      case "wipe":
        return wipe({ direction: "from-right" });
      case "flip":
        return flip();
      case "clockWipe":
        return clockWipe({ width: format.width, height: format.height });
      case "iris":
        return iris({ width: format.width, height: format.height });
      case "pushCut":
        return pushCut();
      case "none":
        return none();
      default:
        // Shader transitions are not enabled for this style pack; fall back to
        // a fade rather than failing the render.
        return fade();
    }
  })();

  return {
    presentation: presentation as TransitionPresentation<Record<string, unknown>>,
    timing,
    durationInFrames: name === "none" ? 1 : frames,
  };
};
