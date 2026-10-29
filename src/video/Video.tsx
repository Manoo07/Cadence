/**
 * The composition. Spec in, frames out.
 *
 * Scene durations are padded to cancel TransitionSeries' overlap, so the
 * picture stays locked to the voiceover however many transitions are used.
 * That arithmetic lives in `core/timeline.ts`, where it is unit-tested —
 * see the comment there for why it is not as simple as adding half a
 * transition to each side.
 */

import React, { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import type { VideoSpec } from "../core/types.ts";
import { planTimeline } from "../core/timeline.ts";
import { Captions } from "../captions/Captions.tsx";
import { Progress } from "../kit/index.ts";
import { getStyle } from "../kit/styles/index.ts";
import { SceneHost } from "./SceneHost.tsx";
import { resolveTransition } from "./transitions.ts";

export type VideoProps = { spec: VideoSpec };

export const Video: React.FC<VideoProps> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = getStyle(spec.meta.style);

  /** Resolve every transition once, then derive the padded durations. */
  const plan = useMemo(() => {
    const transitions = spec.scenes.map((scene, i) =>
      i === 0
        ? null
        : resolveTransition(
            scene.options.transition ?? "fade",
            style,
            spec.format,
            scene.options.transitionMs,
          ),
    );

    const { durations } = planTimeline(
      spec.scenes.map((s) => s.durationInFrames),
      transitions.map((t) => t?.durationInFrames ?? 0),
    );

    return { transitions, durations };
  }, [spec, style]);

  return (
    <AbsoluteFill style={{ background: style.palette.bg }}>
      <TransitionSeries>
        {spec.scenes.map((scene, i) => {
          const transition = plan.transitions[i];
          return (
            <React.Fragment key={scene.id}>
              {transition && (
                <TransitionSeries.Transition
                  presentation={transition.presentation}
                  timing={transition.timing}
                />
              )}
              <TransitionSeries.Sequence durationInFrames={plan.durations[i]!} name={scene.label}>
                <SceneHost scene={scene} styleName={spec.meta.style} format={spec.format} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {spec.audio.voiceover && <Audio src={staticFile(spec.audio.voiceover)} />}
      {spec.audio.music && (
        <Audio
          src={staticFile(spec.audio.music)}
          volume={10 ** (spec.audio.musicGainDb / 20)}
          loop
        />
      )}

      <Captions
        words={spec.captions}
        theme={spec.meta.captions ?? "selection"}
        style={style}
        format={spec.format}
        frame={frame}
        fps={fps}
      />

      <Progress
        progress={frame / Math.max(1, spec.durationInFrames)}
        color={style.palette.accent}
        height={5 * (spec.format.width / 1080)}
      />
    </AbsoluteFill>
  );
};
