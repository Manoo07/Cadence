/**
 * The Remotion root.
 *
 * One generic composition, parameterised by a spec. The project being rendered
 * is chosen by the VIDEO_PROJECT environment variable, which the CLI sets, so
 * `remotion studio` and `remotion render` both work without a separate
 * composition per video.
 */

import React from "react";
import { Composition } from "remotion";
import { loadFont as loadSans } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { FORMATS, type VideoSpec } from "../core/types.ts";
import { Video } from "./Video.tsx";
import { loadProjectSpec } from "./loadSpec.ts";

// Explicit weights and subsets: required from Remotion 5, and it keeps the
// render from pulling font files it never uses.
loadSans("normal", { weights: ["400", "500", "700", "800"], subsets: ["latin"] });
loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

const FALLBACK: VideoSpec = {
  version: 1,
  meta: {
    title: "No project selected",
    voice: "",
    style: "paper-vector",
    format: "9x16",
    captions: "none",
  },
  format: FORMATS["9x16"],
  durationInFrames: 90,
  audio: { voiceover: "", musicGainDb: -22 },
  scenes: [
    {
      id: "empty",
      label: "00 — no project",
      layout: "title",
      props: {
        text: "No project loaded",
        subtitle: "Run: pnpm cadence build <project>",
        eyebrow: "cadence",
      },
      startFrame: 0,
      durationInFrames: 90,
      beats: [],
      options: {},
    },
  ],
  captions: [],
};

export const RemotionRoot: React.FC = () => {
  const spec = loadProjectSpec() ?? FALLBACK;

  return (
    <Composition
      id="Video"
      component={Video}
      // The duration and dimensions belong to whichever spec is actually
      // passed in, not to the one present when the bundle was built. Without
      // calculateMetadata the composition keeps the build-time values and
      // every render is clamped to them.
      calculateMetadata={({ props }) => {
        const s = props.spec ?? spec;
        return {
          durationInFrames: Math.max(1, s.durationInFrames),
          fps: s.format.fps,
          width: s.format.width,
          height: s.format.height,
        };
      }}
      durationInFrames={Math.max(1, spec.durationInFrames)}
      fps={spec.format.fps}
      width={spec.format.width}
      height={spec.format.height}
      defaultProps={{ spec }}
    />
  );
};
