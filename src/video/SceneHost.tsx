/**
 * SceneHost — the frame around every scene.
 *
 * Each scene component is responsible only for its own content. Everything
 * that must be identical across all scenes lives here: the ground colour, the
 * camera move, the corner label, the paper texture. Centralising it is what
 * keeps a twenty-scene video feeling like one object.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import type { Format, SpecScene } from "../core/types.ts";
import { PaperTexture, SceneLabel, SceneProvider, useScene } from "../kit/index.ts";
import { cameraTransform } from "../kit/camera.ts";
import { getLayout } from "../scenes/registry.ts";

const Inner: React.FC<{ scene: SpecScene }> = ({ scene }) => {
  const { style, frame, durationInFrames, format } = useScene();
  const layout = getLayout(scene.layout);

  const transform = cameraTransform(
    frame,
    durationInFrames,
    style.motion,
    scene.options.camera ?? "push",
  );

  return (
    <AbsoluteFill style={{ background: style.palette.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform, transformOrigin: "center center" }}>
        {layout ? (
          <layout.component {...(scene.props as Record<string, unknown>)} />
        ) : (
          <AbsoluteFill
            style={{
              justifyContent: "center",
              alignItems: "center",
              color: style.palette.accent,
              fontFamily: style.type.mono,
              fontSize: 36,
              textAlign: "center",
              padding: format.safe.left,
            }}
          >
            {`Unknown layout "${scene.layout}"`}
          </AbsoluteFill>
        )}
      </AbsoluteFill>

      <SceneLabel label={scene.label} />
      <PaperTexture />
    </AbsoluteFill>
  );
};

export const SceneHost: React.FC<{
  scene: SpecScene;
  styleName: string;
  format: Format;
}> = ({ scene, styleName, format }) => (
  <SceneProvider
    styleName={styleName}
    format={format}
    durationInFrames={scene.durationInFrames}
    beats={scene.beats}
  >
    <Inner scene={scene} />
  </SceneProvider>
);
